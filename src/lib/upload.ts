import fs from "fs/promises";
import path from "path";
import { getStore } from "@netlify/blobs";
import { IS_SERVERLESS, UPLOAD_DIR } from "./storage";

/**
 * Uploaded media storage.
 * - Netlify (serverless): files go to Netlify Blobs — PERMANENT, survives
 *   restarts and cold starts (free tier friendly).
 * - Local dev: files go to UPLOAD_DIR on disk, same as before.
 * Both return the same public URL scheme: /api/media/<name>.
 */
const BLOBS_STORE = "coocoo-uploads";

export async function saveUploadedFile(file: File, prefix: string): Promise<string> {
  const ext = path.extname(file.name || "").toLowerCase() || "";
  const safe = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const ab = await file.arrayBuffer();

  if (IS_SERVERLESS) {
    const store = getStore(BLOBS_STORE);
    await store.set(safe, ab);
    return `/api/media/${safe}`;
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, safe), Buffer.from(ab));
  return `/api/media/${safe}`;
}

/**
 * Delete an uploaded file referenced by a DB row URL.
 * Handles both the new /api/media/<name> scheme and the legacy /uploads/<name>
 * scheme (old rows). External cloud URLs are ignored.
 * Blob delete is verified with a strong-consistency read; errors are logged
 * (visible in Netlify Logs -> Functions) instead of being swallowed.
 */
export async function removeUploadedFile(url: string): Promise<void> {
  if (!url) return;
  let name: string | null = null;
  if (url.startsWith("/api/media/")) name = url.slice("/api/media/".length);
  else if (url.startsWith("/uploads/")) name = url.slice("/uploads/".length);
  else return; // external URL — nothing stored locally
  name = path.basename(name);
  if (!name || name.startsWith(".")) return;

  if (IS_SERVERLESS) {
    try {
      const store = getStore(BLOBS_STORE);
      await store.delete(name);

      // Blobs is eventually consistent by default (up to 60s). Verify with a
      // strong read and retry once so the file is really gone.
      const strong = getStore({ name: BLOBS_STORE, consistency: "strong" });
      const left = await strong.get(name);
      if (left) {
        console.error("[coocoo:upload] blob survived delete, retrying:", name);
        await strong.delete(name);
        const again = await strong.get(name);
        console.error("[coocoo:upload] retry:", again ? "STILL PRESENT" : "deleted ok");
      }
    } catch (err) {
      console.error("[coocoo:upload] blob delete failed:", name, err);
    }
    return;
  }

  try {
    await fs.unlink(path.join(UPLOAD_DIR, name));
  } catch {
    // file may already be gone (or a legacy static asset)
  }
}
