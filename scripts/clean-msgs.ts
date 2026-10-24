import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const del = await db.listenerMessage.deleteMany({});
console.log("cleared:", del.count);
await db.$disconnect();
