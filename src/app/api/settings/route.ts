import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

const KEYS = [
  "stationName",
  "tagline",
  "liveMode",
  "liveUrl",
  "playlist",
  "liveTitle",
  "liveImage",
  "streamLibrary",
  "artistImages",
  "playerStyle",
  "donationUpi",
  "donationNote",
  "donationQr",
  "onAirVideo",
  "theme",
  "tickerStyle",
  "gurbaniSchedule",
] as const;

export async function GET() {
  const rows = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return NextResponse.json({
    stationName: map.stationName || "CooCoo Radio 24x7",
    tagline: map.tagline || "ਹਰ ਪੱਲ ਤੁਹਾਡੇ ਨਾਲ • Punjabi • English",
    liveMode: map.liveMode || "auto",
    liveUrl: map.liveUrl || "",
    playlist: map.playlist || "",
    liveTitle: map.liveTitle || "Darbar Sahib Live",
    liveImage: map.liveImage || "",
    streamLibrary: map.streamLibrary || "",
    artistImages: map.artistImages || "",
    playerStyle: map.playerStyle || "",
    donationUpi: map.donationUpi || "",
    donationNote: map.donationNote || "",
    donationQr: map.donationQr || "",
    onAirVideo: map.onAirVideo || "",
    theme: map.theme || "",
    tickerStyle: map.tickerStyle || "",
    gurbaniSchedule: map.gurbaniSchedule || "",
  });
}

export async function PUT(req: NextRequest) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin settings badal sakda hai" }, { status: 401 });
  try {
    const body = (await req.json()) as Record<string, string>;
    for (const key of KEYS) {
      if (typeof body[key] === "string") {
        await db.setting.upsert({
          where: { key },
          update: { value: body[key] },
          create: { key, value: body[key] },
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Settings save nahi hoyian" }, { status: 500 });
  }
}
