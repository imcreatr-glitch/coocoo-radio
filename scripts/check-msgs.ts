import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const msgs = await db.listenerMessage.findMany({ orderBy: { addedAt: "desc" } });
console.log("Total:", msgs.length);
msgs.forEach(m => console.log(`- [${m.type}] ${m.name} (${m.city}): ${m.message.slice(0, 50)} | read=${m.read}`));
await db.$disconnect();
