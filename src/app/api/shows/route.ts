import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ytId } from "@/lib/types";

export async function GET() {
  const shows = await db.show.findMany({ orderBy: { startTime: "asc" } });
  return NextResponse.json(shows);
}

export async function POST(req: NextRequest) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin show add kar sakda hai" }, { status: 401 });
  try {
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      youtubeUrl?: string;
      startTime?: string;
      endTime?: string;
      days?: string[];
    };
    const title = (body.title || "").trim();
    const youtubeUrl = (body.youtubeUrl || "").trim();
    if (!title || !youtubeUrl) {
      return NextResponse.json({ error: "Title te YouTube link dono chahide ne" }, { status: 400 });
    }
    if (!ytId(youtubeUrl)) {
      return NextResponse.json({ error: "Sahi YouTube link do (watch/youtu.be/shorts)" }, { status: 400 });
    }
    const timeRe = /^([01]?\d|2[0-3]):[0-5]\d$/;
    const startTime = (body.startTime || "").trim();
    const endTime = (body.endTime || "").trim();
    if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
      return NextResponse.json({ error: "Timing HH:MM format vich do (jiven 06:00)" }, { status: 400 });
    }
    const days = (body.days && body.days.length ? body.days : ["0", "1", "2", "3", "4", "5", "6"])
      .map((d) => Number(d))
      .filter((d) => d >= 0 && d <= 6)
      .sort()
      .join(",");
    const show = await db.show.create({
      data: {
        title,
        description: (body.description || "").trim() || null,
        youtubeUrl,
        startTime,
        endTime,
        days,
      },
    });
    return NextResponse.json(show);
  } catch {
    return NextResponse.json({ error: "Show add nahi hoya" }, { status: 500 });
  }
}
