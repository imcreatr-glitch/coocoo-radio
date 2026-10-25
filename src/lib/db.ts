import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { BUNDLED_DB_B64 } from "./db-bundle";

const SEED_MIN_BYTES = 4096 // real seeded db is ~72KB; 0-byte files are invalid

// ─── Turso (permanent cloud DB) ──────────────────────────────────────────────
// When TURSO_DATABASE_URL is present (Netlify env vars), ALL data lives in the
// cloud database — songs, news, uploads metadata survive restarts forever.
const TURSO_URL = process.env.TURSO_DATABASE_URL?.trim() || ""
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN?.trim() || ""

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
      } catch (
