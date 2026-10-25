import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getStore } from "@netlify/blobs";
import { IS_SERVERLESS, UPLOAD_DIR } from "@/lib/storage";

const BLOBS_STORE = "coocoo-uploads";

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

/** Parse an HTTP Range header ("bytes=start-end" / "bytes=-N") against size. */
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return null;
  let start: number;
  let end: number;
  if (!m[1]) {
    // suffix range: last N bytes
    const n = Number(m[2]);
    if (!n) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

/**
 * Serves runtime-uploaded media.
 * - Netlify (serverless): reads from Netlify Blobs (permanent storage).
 *   Full requests stream (no 6MB response cap), Range requests seek.
 * - Local dev: reads from UPLOAD_DIR on disk.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const clean = path.basename(decodeURIComponent(name));
  if (!clean || clean.startsWith(".") || clean.includes("/") || clean.includes("\\")) {
    return notFound();
  }
  const ext = path.extname(clean).toLowerCase();
  const type = MIME[ext];
  if (!type) return new NextResponse("Unsupported media type", { status: 400 });

  const rangeHeader = req.headers.get("range");

  // ── Netlify Blobs path (serverless) ──
  if (IS_SERVERLESS) {
    try {
      const store = getStore({ name: BLOBS_STORE, consistency: "strong" });

      if (rangeHeader) {
        // Range: buffer and slice (audio seeking / Safari compatibility)
        const blob = await store.get(clean, { type: "arrayBuffer" });
        if (!blob) return notFound();
        const r = parseRange(rangeHeader, blob.byteLength);
        if (r) {
          const slice = blob.slice(r.start, r.end + 1);
          return new NextResponse(slice, {
            status: 206,
            headers: {
              "Content-Type": type,
              "Content-Length": String(slice.byteLength),
              "Content-Range": `bytes ${r.start}-${r.end}/${blob.byteLength}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
        // unparsable range → fall through to a normal full response
      }

      // Full request: stream straight from Blobs (works for any size)
      const stream = await store.get(clean, { type: "stream" });
      if (!stream) return notFound();
      return new NextResponse(stream, {
        headers: {
          "Content-Type": type,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (err) {
      console.error("[coocoo:media] blobs read failed:", clean, err);
      return notFound();
    }
  }

  // ── Local filesystem path (dev) ──
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, clean));
    const r = rangeHeader ? parseRange(rangeHeader, buf.length) : null;
    if (r) {
      const slice = buf.subarray(r.start, r.end + 1);
      return new NextResponse(new Uint8Array(slice), {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Length": String(slice.length),
          "Content-Range": `bytes ${r.start}-${r.end}/${buf.length}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(buf.length),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return notFound();
  }
}
