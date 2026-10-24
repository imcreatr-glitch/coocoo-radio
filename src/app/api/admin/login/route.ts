import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, checkAdminUser, makeToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };
    if (!username || !password) {
      return NextResponse.json({ error: "Username te password chahida hai" }, { status: 400 });
    }
    const ok = await checkAdminUser(username, password);
    if (!ok) {
      return NextResponse.json({ error: "Galat username ja password" }, { status: 401 });
    }
    const token = makeToken(username);
    const res = NextResponse.json({ ok: true, username, token });
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login fail ho gaya" }, { status: 500 });
  }
}
