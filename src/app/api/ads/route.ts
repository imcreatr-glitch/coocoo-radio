import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  const ads = await db.ad.findMany({
    where: all ? {} : { active: true },
    orderBy: { addedAt: "desc" },
  });
  return NextResponse.json(ads);
}

export async function POST(req: NextRequest) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin ad add kar sakda hai" }, { status: 401 });
  try {
    const form = await req.formData();
    const title = ((form.get("title") as string) || "").trim();
    const type = ((form.get("type") as string) || "image").trim();
    if (!title) return NextResponse.json({ error: "Ad da title chahida" }, { status: 400 });
    if (!["image", "video"].includes(type)) {
      return NextResponse.json({ error: "Ad type image ja video hona chahida" }, { status: 400 });
    }
    let mediaUrl = "";
    const media = form.get("media") as File | null;
    if (media && media.size) {
      const okRe =
        type === "video"
          ? /\.(mp4|webm|ogv|mov|m4v)$/i
          : /\.(png|jpe?g|gif|webp|avif|svg)$/i;
      if (!okRe.test(media.name || "")) {
        return NextResponse.json(
          { error: type === "video" ? "Video file (mp4/webm) do" : "Image file (jpg/png/webp/gif) do" },
          { status: 400 }
        );
      }
      mediaUrl = await saveUploadedFile(media, "ad");
    } else {
      mediaUrl = ((form.get("mediaUrl") as string) || "").trim();
      if (!/^https?:\/\/|^\//.test(mediaUrl)) {
        return NextResponse.json({ error: "Media file upload karo ja link do" }, { status: 400 });
      }
    }
    const link = ((form.get("link") as string) || "").trim() || null;
    const ad = await db.ad.create({ data: { title, type, mediaUrl, link } });
    return NextResponse.json(ad);
  } catch {
    return NextResponse.json({ error: "Ad add nahi hoya" }, { status: 500 });
  }
}
