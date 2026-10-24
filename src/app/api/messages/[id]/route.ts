import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Admin: mark message as read
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin badal sakda hai" }, { status: 401 });
  const { id } = await params;
  try {
    const { read } = (await req.json()) as { read?: boolean };
    const msg = await db.listenerMessage.update({ where: { id }, data: { read: !!read } });
    return NextResponse.json(msg);
  } catch {
    return NextResponse.json({ error: "Update nahi hoya" }, { status: 500 });
  }
}

// Admin: delete message
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin delete kar sakda hai" }, { status: 401 });
  const { id } = await params;
  try {
    await db.listenerMessage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete nahi hoya" }, { status: 500 });
  }
}
