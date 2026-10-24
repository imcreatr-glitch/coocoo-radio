import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const del = await db.song.deleteMany({ where: { title: "test" } });
console.log("test songs deleted:", del.count);
await db.$disconnect();
