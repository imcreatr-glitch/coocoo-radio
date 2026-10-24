import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { removeUploadedFile } from "@/lib/upload";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin delete kar sakda hai" }, { status: 401 });
  const { id } = await params;
  try {
    const item = await db.news.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "News nahi mili" }, { status: 404 });
    if (item.imageUrl) await removeUploadedFile(item.imageUrl);
    await db.news.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete nahi hoya" }, { status: 500 });
  }
}
