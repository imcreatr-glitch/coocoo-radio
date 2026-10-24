/**
 * One-off cleanup: remove Hindi news + update tagline (user removed Hindi language)
 * Run: bun scripts/remove-hindi.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const del = await db.news.deleteMany({ where: { language: "hindi" } });
  console.log("Hindi news deleted:", del.count);

  // Update tagline if it still mentions Hindi
  const tagline = await db.setting.findUnique({ where: { key: "tagline" } });
  if (tagline && /hindi|हिंदी/i.test(tagline.value)) {
    await db.setting.update({
      where: { key: "tagline" },
      data: { value: "ਹਰ ਪੱਲ ਤੁਹਾਡੇ ਨਾਲ • Punjabi • English" },
    });
    console.log("Tagline updated to Punjabi • English");
  }

  // Any leftover hindi news rows with other language labels? Safety net:
  const langs = await db.news.groupBy({ by: ["language"], _count: true });
  console.log("News languages now:", langs.map((l) => `${l.language}=${l._count}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
