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

/** Strongly-consistent store handle — read-after-write safe (chunk assembly). */
const strongStore = () => getStore({ name: BLOBS_STORE, consistency: "strong" });

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
 * Chunked upload support for files larger than the Netlify 6MB function
 * request-body limit. The browser sends the file in 4MB slices; each slice
 * is stored as its own blob, then finalizeChunkedUpload() stitches them
 * together into the final blob and cleans the slices up.
 */
export const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB — safely under the 6MB limit

export async function initChunkedUpload(uploadId: string): Promise<void> {
  if (IS_SERVERLESS) return; // blobs are key/value — nothing to prepare
  await fs.mkdir(path.join(UPLOAD_DIR, "chunks", uploadId), { recursive: true });
}

export async function storeChunk(uploadId: string, index: number, data: ArrayBuffer): Promise<void> {
  if (IS_SERVERLESS) {
    await strongStore().set(`up/${uploadId}/${index}`, data);
    return;
  }
  await fs.writeFile(path.join(UPLOAD_DIR, "chunks", uploadId, String(index)), Buffer.from(data));
}

export async function finalizeChunkedUpload(
  uploadId: string,
  count: number,
  filename: string
): Promise<string> {
  const ext = path.extname(filename || "").toLowerCase() || "";
  const safe = `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  if (IS_SERVERLESS) {
    const store = strongStore();
    const parts: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      const blob = await store.get(`up/${uploadId}/${i}`, { type: "arrayBuffer" });
      if (!blob) throw new Error(`chunk ${i} missing`);
      parts.push(Buffer.from(blob));
    }
    await store.set(safe, Buffer.concat(parts));
    // best-effort cleanup of the slice blobs
    for (let i = 0; i < count; i++) {
      try {
        await store.delete(`up/${uploadId}/${i}`);
      } catch {
        // slice may already be gone — fine
      }
    }
    return safe;
  }

  const dir = path.join(UPLOAD_DIR, "chunks", uploadId);
  const parts: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    parts.push(await fs.readFile(path.join(dir, String(i))));
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, safe), Buffer.concat(parts));
  await fs.rm(dir, { recursive: true, force: true });
  return safe;
}

/**
 * Delete an uploaded file referenced by a DB row URL.
 * Handles both the new /api/media/<name> scheme and the legacy /uploads/<name>
 * scheme (old rows). External cloud URLs are ignored.
 *
 * SAFETY: no strong-consistency verification read after delete — strong reads
 * of just-deleted keys hang on Blobs, which got the whole function killed by
 * the gateway (502/504 at ~30s). A plain delete is best-effort; a briefly
 * lingering blob is harmless (the DB row drives the UI). The whole operation
 * is also capped at 8s so delete APIs ALWAYS answer in time.
 */
export async function removeUploadedFile(url: string): Promise<void> {
  if (!url) return;
  let name: string | null = null;
  if (url.startsWith("/api/media/")) name = url.slice("/api/media/".length);
  else if (url.startsWith("/uploads/")) name = url.slice("/uploads/".length);
  else return; // external URL — nothing stored locally
  name = path.basename(name);
  if (!name || name.startsWith(".")) return;

  const target = name;
  const work = (async () => {
    if (IS_SERVERLESS) {
      try {
        await getStore(BLOBS_STORE).delete(target);
      } catch (err) {
        console.error("[coocoo:upload] blob delete failed:", target, err);
      }
      return;
    }
    try {
      await fs.unlink(path.join(UPLOAD_DIR, target));
    } catch {
      // file may already be gone (or a legacy static asset)
    }
  })();

  const budget = new Promise<void>((resolve) => setTimeout(resolve, 8000));
  await Promise.race([work, budget]);
}
