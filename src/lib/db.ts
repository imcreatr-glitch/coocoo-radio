import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { BUNDLED_DB_B64 } from "./db-bundle";

/**
 * Database bootstrap.
 *
 * Local dev: DATABASE_URL comes from .env (db/custom.db) and is used untouched.
 *
 * Serverless hosting (Netlify): the filesystem is read-only except /tmp, and
 * every cold-started function instance gets a fresh one. So on Netlify the
 * SQLite database is materialized into /tmp on first use:
 *   1. copy the traced db/custom.db if it made it into the lambda bundle
 *   2. otherwise fall back to the base64 snapshot (src/lib/db-bundle.ts)
 *      generated from db/custom.db by scripts/generate-db-bundle.ts
 *
 * Note: writes persist per instance lifetime only (demo-grade on serverless).
 */
function resolveServerlessDatabaseUrl(): string | null {
  if (!process.env.NETLIFY) return null;
  const target = "/tmp/coocoo.db";
  if (!fs.existsSync(target)) {
    const traced = path.join(process.cwd(), "db", "custom.db");
    try {
      if (fs.existsSync(traced)) {
        fs.copyFileSync(traced, target);
      } else {
        fs.writeFileSync(target, Buffer.from(BUNDLED_DB_B64, "base64"));
      }
    } catch {
      // nothing else we can do — queries will surface the error
    }
  }
  return `file:${target}`;
}

const serverlessUrl = resolveServerlessDatabaseUrl();
if (serverlessUrl) process.env.DATABASE_URL = serverlessUrl;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

globalForPrisma.prisma = db
