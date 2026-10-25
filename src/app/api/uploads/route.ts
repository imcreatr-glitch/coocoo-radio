import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { CHUNK_SIZE, finalizeChunkedUpload, initChunkedUpload, storeChunk } from "@/lib/upload";

const MAX_TOTAL = 50 * 1024 * 1024; // 50MB per song — plenty for audio, safe in one function call
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * Chunked upload for files bigger than the Netlify 6MB function body limit.
 * All admin-only. One route, three actions (fewer moving parts):
 *
 *   POST /api/uploads?action=init      { filename, size }                    -> { uploadId, chunkSize, total }
 *   POST /api/uploads?action=chunk     raw bytes + ?uploadId=&index=         -> { ok, index }
 *   POST /api/uploads?action=complete  { uploadId, filename, count, title, artist } -> song JSON
 *
 * The browser slices the file into 4MB pieces (each safely under the 6MB
 * limit), uploads them one by one, then asks the server to stitch them
 * together into the final blob and create the song row.
 */
export async function POST(req: NextRequest) {
  const username = await getSessionFromRequest(req);
  if (!username) return bad("Sirf admin he song upload kar sakda hai", 401);

  const action = req.nextUrl.searchParams.get("action");

  try {
    // ── step 1: start a new upload ──
    if (action === "init") {
      const body = (await req.json()) as { filename?: string; size?: number };
      const filename = (body.filename || "song.mp3").trim();
      const size = Number(body.size) || 0;
      if (!AUDIO_EXT_RE.test(filename)) {
        return bad("Sirf audio files (mp3, wav, ogg, m4a, aac, flac) chaliyangi");
      }
      if (size <= 0) return bad("File size galat hai");
      if (size > MAX_TOTAL) return bad("File bahut badi hai — 50MB tak di audio chaldii hai");
      const uploadId = crypto.randomUUID();
      await initChunkedUpload(uploadId);
      return NextResponse.json({
        uploadId,
        chunkSize: CHUNK_SIZE,
        total: Math.ceil(size / CHUNK_SIZE),
      });
    }

    // ── step 2: receive one 4MB slice ──
    if (action === "chunk") {
      const uploadId = req.nextUrl.searchParams.get("uploadId") || "";
      const index = Number(req.nextUrl.searchParams.get("index"));
      if (!UUID_RE.test(uploadId)) return bad("Galat uploadId");
      if (!Number.isInteger(index) || index < 0 || index > 99) return bad("Galat chunk index");
      const data = await req.arrayBuffer();
      if (!data.byteLength) return bad("Chunk khali aaya");
      if (data.byteLength > CHUNK_SIZE + 1024 * 1024) return bad("Chunk size limit ton vadda hai");
      await storeChunk(uploadId, index, data);
      return NextResponse.json({ ok: true, index });
    }

    // ── step 3: stitch slices together + create the song ──
    if (action === "complete") {
      const body = (await req.json()) as {
        uploadId?: string;
        filename?: string;
        count?: number;
        title?: string;
        artist?: string;
      };
      const uploadId = body.uploadId || "";
      const filename = (body.filename || "song.mp3").trim();
      const count = Number(body.count);
      if (!UUID_RE.test(uploadId)) return bad("Galat uploadId");
      if (!AUDIO_EXT_RE.test(filename)) return bad("Sirf audio files chaliyangi");
      if (!Number.isInteger(count) || count < 1 || count > 99) return bad("Galat chunk count");

      const finalName = await finalizeChunkedUpload(uploadId, count, filename);
      const title =
        (body.title || "").trim() ||
        filename.replace(/\.[^.]+$/, "").trim() ||
        "Uploaded Song";
      const artist = (body.artist || "").trim() || null;
      const song = await db.song.create({
        data: { title, artist, source: "upload", url: `/api/media/${finalName}` },
      });
      return NextResponse.json(song);
    }

    return bad("Unknown action");
  } catch (err) {
    console.error("[coocoo:uploads] action failed:", action, err);
    return bad("Upload adhura reh gaya — dubara koshish karo", 500);
  }
}
