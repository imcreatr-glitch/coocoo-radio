import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

const TYPES = ["request", "greeting", "shoutout"];

// Admin: list all listener messages
export async function GET(req: NextRequest) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin messages vekh sakda hai" }, { status: 401 });
  const messages = await db.listenerMessage.findMany({ orderBy: { addedAt: "desc" } });
  return NextResponse.json(messages);
}

// Public: listener sends a song request / greeting / shoutout
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string;
      city?: string;
      type?: string;
      message?: string;
      showTitle?: string;
    };
    const name = (body.name || "").trim();
    const message = (body.message || "").trim();
    const type = (body.type || "request").trim();
    if (!name || !message) {
      return NextResponse.json({ error: "Naam te message dono likho" }, { status: 400 });
    }
    if (name.length > 40) {
      return NextResponse.json({ error: "Naam bahut lamba aa (max 40)" }, { status: 400 });
    }
    if (message.length > 500) {
      return NextResponse.json({ error: "Message bahut lamba aa (max 500)" }, { status: 400 });
    }
    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: "Type request/greeting/shoutout vichon chuno" }, { status: 400 });
    }
    const msg = await db.listenerMessage.create({
      data: {
        name,
        city: (body.city || "").trim() || null,
        type,
        message,
        showTitle: (body.showTitle || "").trim() || null,
      },
    });
    return NextResponse.json(msg);
  } catch {
    return NextResponse.json({ error: "Message send nahi hoya, dubara karo" }, { status: 500 });
  }
}
