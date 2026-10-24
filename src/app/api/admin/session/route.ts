import { NextRequest, NextResponse } from "next/server";
import { hashPassword, getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const username = await getSessionFromRequest(req);
  return NextResponse.json({ authenticated: !!username, username });
}

// change password
export async function PUT(req: NextRequest) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Login karo pehla" }, { status: 401 });
  try {
    const { currentPassword, newPassword } = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword || newPassword.length < 4) {
      return NextResponse.json(
        { error: "Nava password ghatt vadde 4 aksharan da hona chahida" },
        { status: 400 }
      );
    }
    const user = await db.adminUser.findUnique({ where: { username } });
    if (!user || user.password !== hashPassword(currentPassword)) {
      return NextResponse.json({ error: "Current password galat hai" }, { status: 400 });
    }
    await db.adminUser.update({
      where: { username },
      data: { password: hashPassword(newPassword) },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Password update nahi hoya" }, { status: 500 });
  }
}
