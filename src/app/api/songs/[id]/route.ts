import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { removeUploadedFile } from "@/lib/upload";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin he delete kar sakda hai" }, { status: 401 });
  const { id } = await params;
  try {
    const song = await db.song.findUnique({ where: { id } });
    if (!song) return NextResponse.json({ error: "Song nahi milia" }, { status: 404 });
    if (song.source === "upload") await removeUploadedFile(song.url);
    await db.song.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete nahi hoya" }, { status: 500 });
  }
}
