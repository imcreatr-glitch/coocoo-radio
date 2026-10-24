import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * HTTP-polling chat fallback (used on serverless hosting like Netlify where
 * the socket.io chat mini-service is not reachable). Returns/accepts the same
 * message shape the socket protocol uses: { id, name, text, at, type }.
 */

function toMsg(r: { id: string; name: string; body: string; createdAt: Date }) {
  return { id: r.id, name: r.name, text: r.body, at: r.createdAt.getTime(), type: "user" as const };
}

export async function GET() {
  try {
    const rows = await db.chatMessage.findMany({ orderBy: { createdAt: "desc" }, take: 80 });
    return NextResponse.json(rows.map(toMsg).reverse());
  } catch {
    // degrade quietly (e.g. table missing on an old snapshot) — client shows empty chat
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: unknown; text?: unknown };
    const name = String(body.name ?? "").trim().slice(0, 24);
    const text = String(body.text ?? "").trim().slice(0, 300);
    if (!name || !text) {
      return NextResponse.json({ error: "Naam te message dono chahide ne" }, { status: 400 });
    }
    const row = await db.chatMessage.create({ data: { name, body: text } });
    return NextResponse.json(toMsg(row), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Chat service busy — thodi der baad try karo" }, { status: 500 });
  }
}
