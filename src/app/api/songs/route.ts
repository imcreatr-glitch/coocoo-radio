import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";

export async function GET() {
  const songs = await db.song.findMany({ orderBy: { addedAt: "asc" } });
  return NextResponse.json(songs);
}

// Add song: multipart (file upload from PC) or JSON (cloud link)
export async function POST(req: NextRequest) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin he song add kar sakda hai" }, { status: 401 });
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file || !file.size) {
        return NextResponse.json({ error: "Koi MP3 file nahi mili" }, { status: 400 });
      }
      const name = file.name || "song.mp3";
      if (!/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) {
        return NextResponse.json({ error: "Sirf audio files (mp3, wav, ogg, m4a) chaliyangi" }, { status: 400 });
      }
      const title = ((form.get("title") as string) || name.replace(/\.[^.]+$/, "")).trim();
      const artist = ((form.get("artist") as string) || "").trim() || null;
      const url = await saveUploadedFile(file, "song");
      const song = await db.song.create({
        data: { title, artist, source: "upload", url },
      });
      return NextResponse.json(song);
    }
    // JSON cloud link
    const body = (await req.json()) as { title?: string; artist?: string; url?: string };
    const url = (body.url || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Sahi cloud link (http/https) do" }, { status: 400 });
    }
    let title = (body.title || "").trim();
    if (!title) {
      try {
        title = decodeURIComponent(url.split("/").pop() || "").replace(/\.[^.]+$/, "") || "Cloud Song";
      } catch {
        title = "Cloud Song";
      }
    }
    const song = await db.song.create({
      data: { title, artist: (body.artist || "").trim() || null, source: "link", url },
    });
    return NextResponse.json(song);
  } catch {
    return NextResponse.json({ error: "Song add nahi hoya, dubara karo" }, { status: 500 });
  }
}
