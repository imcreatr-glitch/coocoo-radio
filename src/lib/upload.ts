import fs from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "./storage";

/**
 * Save an uploaded file and return a stable public URL.
 * The file lives in UPLOAD_DIR and is served via /api/media/<name> — this works
 * identically in local dev (read-write FS) and on Netlify (uploads in /tmp).
 */
export async function saveUploadedFile(file: File, prefix: string): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name || "").toLowerCase() || "";
  const safe = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, safe), buf);
  return `/api/media/${safe}`;
}

/**
 * Delete an uploaded file referenced by a DB row URL.
 * Handles both the new /api/media/<name> scheme and the legacy /uploads/<name>
 * scheme (old rows). External cloud URLs are ignored.
 */
export async function removeUploadedFile(url: string): Promise<void> {
  if (!url) return;
  let name: string | null = null;
  if (url.startsWith("/api/media/")) name = url.slice("/api/media/".length);
  else if (url.startsWith("/uploads/")) name = url.slice("/uploads/".length);
  else return; // external URL — nothing stored locally
  name = path.basename(name);
  if (!name || name.startsWith(".")) return;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, name));
  } catch {
    // file may already be gone (or a legacy static asset)
  }
}
