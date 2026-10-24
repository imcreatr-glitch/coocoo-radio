import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SECRET = process.env.AUTH_SECRET || "coocoo-radio-secret-2026";
export const ADMIN_COOKIE = "coocoo_admin";

export function hashPassword(password: string): string {
  return crypto.createHmac("sha256", SECRET).update(password).digest("hex");
}

export function makeToken(username: string): string {
  const payload = `${username}|${Date.now()}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  let payload: string;
  try {
    payload = Buffer.from(token.slice(0, dot), "base64url").toString();
  } catch {
    return null;
  }
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const username = payload.split("|")[0];
  // token valid for 30 days
  const ts = Number(payload.split("|")[1]);
  if (!ts || Date.now() - ts > 30 * 24 * 3600 * 1000) return null;
  return username;
}

export async function getSession(): Promise<string | null> {
  const store = await cookies();
  return verifyToken(store.get(ADMIN_COOKIE)?.value);
}

/**
 * Session check that works in ALL environments:
 * 1. x-admin-token header (used when cookies are blocked, e.g. preview iframe / WebView)
 * 2. httpOnly cookie fallback
 */
export async function getSessionFromRequest(req: Request): Promise<string | null> {
  const headerToken = req.headers.get("x-admin-token");
  if (headerToken) {
    const fromHeader = verifyToken(headerToken);
    if (fromHeader) return fromHeader;
  }
  return getSession();
}

export async function checkAdminUser(username: string, password: string): Promise<boolean> {
  // Serverless (Netlify): ADMIN_PASSWORD env var wins — DB resets on cold start there.
  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  if (envPassword) {
    return username === "admin" && password === envPassword;
  }
  const user = await db.adminUser.findUnique({ where: { username } });
  if (!user) return false;
  return user.password === hashPassword(password);
}
