import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/storage";

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
 * Serves runtime-uploaded media from UPLOAD_DIR.
 * On local dev UPLOAD_DIR is public/uploads; on Netlify it is /tmp/uploads
 * (files can't be served statically from /tmp, hence this route).
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
