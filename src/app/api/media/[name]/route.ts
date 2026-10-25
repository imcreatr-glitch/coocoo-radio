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

/**
 * Serves runtime-uploaded media.
 * - Netlify (serverless): reads from Netlify Blobs (permanent storage).
 * - Local dev: reads from UPLOAD_DIR on disk.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const clean = path.basename(decodeURIComponent(name));
  if (!clean || clean.startsWith(".") || clean.includes("/") || clean.includes("\\")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const ext = path.extname(clean).toLowerCase();
  const type = MIME[ext];
  if (!type) return new NextResponse("Unsupported media type", { status: 400 });

  // ── Netlify Blobs path (serverless) ──
  if (IS_SERVERLESS) {
    try {
      const store = getStore(BLOBS_STORE);
      const blob = await store.get(clean, { type: "arrayBuffer" });
      if (!blob) return new NextResponse("Not found", { status: 404 });
      return new NextResponse(blob, {
        headers: {
          "Content-Type": type,
          "Content-Length": String(blob.byteLength),
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  // ── Local filesystem path (dev) ──
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, clean));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
