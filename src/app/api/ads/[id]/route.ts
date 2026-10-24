import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { removeUploadedFile } from "@/lib/upload";

// toggle active
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin ad badal sakda hai" }, { status: 401 });
  const { id } = await params;
  try {
    const { active } = (await req.json()) as { active?: boolean };
    const ad = await db.ad.update({ where: { id }, data: { active: !!active } });
    return NextResponse.json(ad);
  } catch {
    return NextResponse.json({ error: "Update nahi hoya" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin delete kar sakda hai" }, { status: 401 });
  const { id } = await params;
  try {
    const ad = await db.ad.findUnique({ where: { id } });
    if (!ad) return NextResponse.json({ error: "Ad nahi milia" }, { status: 404 });
    if (ad.mediaUrl.startsWith("/uploads/")) await removeUploadedFile(ad.mediaUrl);
    await db.ad.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete nahi hoya" }, { status: 500 });
  }
}
