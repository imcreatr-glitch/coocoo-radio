import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { BUNDLED_DB_B64 } from "./db-bundle";

const SEED_MIN_BYTES = 4096 // real seeded db is ~72KB; 0-byte files are invalid

function isServerlessRuntime(): boolean {
  return !!(
    process.env.NETLIFY ||
    process.env.NETLIFY_DEV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV
  )
}

function dbFileLooksValid(file: string): boolean {
  try {
    return fs.existsSync(file) && fs.statSync(file).size > SEED_MIN_BYTES
  } catch {
    return false
  }
}

function materializeServerlessDb(): string {
  const target = "/tmp/coocoo.db"
  if (dbFileLooksValid(target)) {
    console.log("[coocoo:db] using existing /tmp/coocoo.db")
    return target
  }
  const candidates = [
    path.join(process.cwd(), "db", "custom.db"),
    path.join(process.cwd(), "..", "db", "custom.db"),
    path.join(process.cwd(), "..", "..", "db", "custom.db"),
  ]
  for (const candidate of candidates) {
    if (dbFileLooksValid(candidate)) {
      try {
        fs.copyFileSync(candidate, target)
        console.log("[coocoo:db] materialized from traced file:", candidate)
        return target
      } catch (err) {
        console.error("[coocoo:db] copy failed:", candidate, err)
      }
    }
  }
  try {
    fs.writeFileSync(target, Buffer.from(BUNDLED_DB_B64, "base64"))
    console.log("[coocoo:db] materialized from bundled snapshot")
  } catch (err) {
    console.error("[coocoo:db] FATAL: could not materialize database:", err)
  }
  return target
}

if (!process.env.DATABASE_URL || isServerlessRuntime()) {
  if (isServerlessRuntime()) {
    process.env.DATABASE_URL = `file:${materializeServerlessDb()}`
  } else if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.join(process.cwd(), "db", "custom.db")}`
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()
globalForPrisma.prisma = db
