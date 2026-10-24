import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";

const LANGS = ["punjabi", "english"];

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("language");
  const news = await db.news.findMany({
    where: lang && LANGS.includes(lang) ? { language: lang } : {},
    orderBy: { addedAt: "desc" },
  });
  return NextResponse.json(news);
}

export async function POST(req: NextRequest) {
  const username = await getSessionFromRequest(req);
  if (!username) return NextResponse.json({ error: "Sirf admin news add kar sakda hai" }, { status: 401 });
  try {
    const form = await req.formData();
    const title = ((form.get("title") as string) || "").trim();
    const content = ((form.get("content") as string) || "").trim();
    const language = ((form.get("language") as string) || "punjabi").trim();
    if (!title || !content) {
      return NextResponse.json({ error: "Title te content dono chahide ne" }, { status: 400 });
    }
    if (!LANGS.includes(language)) {
      return NextResponse.json({ error: "Bhasha punjabi/english vichon chuno" }, { status: 400 });
    }
    let imageUrl: string | null = null;
    const img = form.get("image") as File | null;
    if (img && img.size) {
      if (!/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(img.name || "")) {
        return NextResponse.json({ error: "Image file (jpg/png/webp/gif) do" }, { status: 400 });
      }
      imageUrl = await saveUploadedFile(img, "news");
    } else {
      const imgUrl = ((form.get("imageUrl") as string) || "").trim();
      if (imgUrl) imageUrl = imgUrl;
    }
    const item = await db.news.create({ data: { title, content, language, imageUrl } });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "News add nahi hoi" }, { status: 500 });
  }
}
