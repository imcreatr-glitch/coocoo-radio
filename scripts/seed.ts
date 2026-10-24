/**
 * Seed script for CooCoo Radio 24x7
 * Run: bun scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "coocoo-radio-secret-2026";
const hash = (pw: string) => crypto.createHmac("sha256", SECRET).update(pw).digest("hex");

const db = new PrismaClient();

async function main() {
  console.log("Seeding CooCoo Radio...");

  // Admin user
  await db.adminUser.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", password: hash("admin123") },
  });

  // Settings
  const settings: Array<[string, string]> = [
    ["stationName", "CooCoo Radio 24x7"],
    ["tagline", "ਹਰ ਪੱਲ ਤੁਹਾਡੇ ਨਾਲ • Punjabi • English"],
    ["liveMode", "auto"],
    ["liveUrl", ""],
  ];
  for (const [key, value] of settings) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // Demo songs (cloud links — delete them from admin anytime)
  const songCount = await db.song.count();
  if (songCount === 0) {
    await db.song.createMany({
      data: [
        {
          title: "Morning Vibes Beat",
          artist: "SoundHelix",
          source: "link",
          url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        },
        {
          title: "Desi Nights Groove",
          artist: "SoundHelix",
          source: "link",
          url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        },
        {
          title: "Highway Bhangra Flow",
          artist: "SoundHelix",
          source: "link",
          url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        },
      ],
    });
  }

  // News in 2 languages (Punjabi + English)
  const newsCount = await db.news.count();
  if (newsCount === 0) {
    await db.news.createMany({
      data: [
        {
          title: "ਪੰਜਾਬੀ ਸੰਗੀਤ ਦੀ ਦੁਨੀਆ ਵਿੱਚ ਨਵਾਂ ਰਿਕਾਰਡ — ਨਵੇਂ ਗਾਣੇ ਨੇ ਪਹਿਲੇ ਦਿਨ ਹੀ ਕੋਟੀ ਵਿਊਜ਼ ਪਾਰ ਕੀਤੀਆਂ",
          content:
            "ਪੰਜਾਬੀ ਮਿਊਜ਼ਿਕ ਇੰਡਸਟਰੀ ਲਈ ਵੱਡਾ ਦਿਨ! ਨਵੇਂ ਰਿਲੀਜ਼ ਹੋਏ ਗਾਣੇ ਨੇ ਸਿਰਫ਼ 24 ਘੰਟਿਆਂ ਵਿੱਚ ਇੱਕ ਕਰੋੜ ਤੋਂ ਵੱਧ ਵਿਊਜ਼ ਪਾਰ ਕਰ ਲਈਆਂ। ਸ਼ੋਅਬਿਜ਼ ਮਾਹਿਰਾਂ ਦਾ ਕਹਿਣਾ ਹੈ ਕਿ ਇਹ ਗਾਣਾ ਸਾਲ ਦਾ ਸਭ ਤੋਂ ਵੱਡਾ ਹਿੱਟ ਬਣਨ ਦੀ ਰਾਹ ਤੇ ਹੈ। CooCoo Radio ਤੇ ਅੱਜ ਸ਼ਾਮ ਨੂੰ ਖ਼ਾਸ ਕਾਉਂਟਡਾਊਨ ਸ਼ੋਅ ਵਿੱਚ ਇਸ ਗਾਣੇ ਦੀ ਪੂਰੀ ਚਰਚਾ ਹੋਵੇਗੀ। ਆਪਣੀਆਂ ਰਾਵਾਂ ਸਾਨੂੰ ਭੇਜੋ ਤੇ ਜਿੱਤੋ ਵਾਧੂ ਸ਼ਾਟਆਊਟ!",
          language: "punjabi",
        },
        {
          title: "Global Charts: Punjabi tracks enter top 10 worldwide for the first time this season",
          content:
            "In a historic moment for Desi music, three Punjabi tracks have simultaneously entered the global top 10 streaming charts this week. Industry analysts credit the growing international audience for Punjabi culture and the viral success of recent collaborations between Western and Indian artists. Stay tuned to CooCoo Radio all day for back-to-back hits, artist interviews, and your favourite retro classics from the 90s and 2000s.",
          language: "english",
        },
      ],
    });
  }

  // Shows with schedule + YouTube videos
  const showCount = await db.show.count();
  if (showCount === 0) {
    await db.show.createMany({
      data: [
        {
          title: "Chardi Kalaa Morning",
          description: "ਸਵੇਰ ਦੀ ਸ਼ੁਰੂਆਤ ਤਾਜ਼ੇ ਪੰਜਾਬੀ ਗਾਣਿਆਂ ਤੇ ਖ਼ੁਸ਼ਖ਼ਬਰੀਆਂ ਨਾਲ — ਮੁਰਗੇ ਦੀ ਅਵਾਜ਼ ਨਾਲ ਜਾਗੋ!",
          youtubeUrl: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
          startTime: "06:00",
          endTime: "09:00",
          days: "1,2,3,4,5,6,0",
        },
        {
          title: "Midday Masti Live",
          description: "ਦੁਪਹਿਰ ਦਾ ਮਜ਼ਾ — ਹਿੱਟ ਤੋਂ ਹਿੱਟ, ਮਸਤੀ ਤੋਂ ਮਸਤੀ! Request show with live shoutouts.",
          youtubeUrl: "https://www.youtube.com/watch?v=JGwWNGJdvx8",
          startTime: "12:00",
          endTime: "14:00",
          days: "1,2,3,4,5,6,0",
        },
        {
          title: "Evening Bhangra Blast",
          description: "ਸ਼ਾਮ ਨੂੰ ਧਮਾਕੇਦਾਰ ਭੰਗੜਾ ਪਲੇਲਿਸਟ — volume high kar te nach shuru kar!",
          youtubeUrl: "https://www.youtube.com/watch?v=OPf0YbXqDm0",
          startTime: "17:00",
          endTime: "20:00",
          days: "1,2,3,4,5,6",
        },
        {
          title: "Midnight Love Dose",
          description: "ਅੱਧੀ ਰਾਤ ਦੇ slow romantic tracks — ਸ਼ਾਂਤ ਮਾਹੌਲ, ਪਿਆਰ ਭਰੀਆਂ ਯਾਦਾਂ। Overnight special.",
          youtubeUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
          startTime: "00:00",
          endTime: "02:00",
          days: "0,1,2,3,4,5,6",
        },
      ],
    });
  }

  // Demo ads
  const adCount = await db.ad.count();
  if (adCount === 0) {
    await db.ad.createMany({
      data: [
        {
          title: "CooCoo Radio — Advertise Here",
          type: "image",
          mediaUrl: "/ads/demo-banner.svg",
          link: "",
          active: true,
        },
        {
          title: "Sample Video Ad",
          type: "video",
          mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
          link: "",
          active: true,
        },
      ],
    });
  }

  console.log("Seed complete: admin/admin123, 3 songs, 2 news, 4 shows, 2 ads.");
  console.log("Songs:", await db.song.count(), "| News:", await db.news.count(), "| Shows:", await db.show.count(), "| Ads:", await db.ad.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
