import fs from "fs/promises";
import path from "path";
import { put, del as blobDel, head as blobHead, list as blobList } from "@vercel/blob";
import { getStore } from "@netlify/blobs";
import { IS_SERVERLESS, UPLOAD_DIR } from "./storage";

/**
 * Uploaded media storage — host-aware:
 * - Vercel (serverless): files go to Vercel Blob — PERMANENT, survives cold
 *   starts. saveUploadedFile() returns the blob's permanent public URL.
 * - Netlify (serverless): files go to Netlify Blobs — same permanence.
 * - Local dev: files go to UPLOAD_DIR on disk, same as before.
 * All flows return either /api/media/<name> (Netlify + chunked finals) or a
 * direct blob URL (Vercel single-shot) — both render in <img>/<audio> tags.
 */
const BLOBS_STORE = "coocoo-uploads";
const IS_VERCEL = !!process.env.VERCEL;

/** Strongly-consistent store handle — read-after-write safe (chunk assembly). */
const strongStore = () => getStore({ name: BLOBS_STORE, consistency: "strong" });

const VERCEL_BLOB_OPTS = { access: "public" as const, addRandomSuffix: false };

export async function saveUploadedFile(file: File, prefix: string): Promise<string> {
  const ext = path.extname(file.name || "").toLowerCase() || "";
  const safe = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const ab = await file.arrayBuffer();

  if (IS_SERVERLESS) {
    if (IS_VERCEL) {
      const blob = await put(safe, ab, VERCEL_BLOB_OPTS);
      return blob.url;
    }
    const store = getStore(BLOBS_STORE);
    await store.set(safe, ab);
    return `/api/media/${safe}`;
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, safe), Buffer.from(ab));
  return `/api/media/${safe}`;
}

/**
 * Chunked upload support for files larger than the serverless function
 * request-body limit (Netlify 6MB / Vercel 4.5MB). The browser sends the
 * file in 4MB slices; each slice is stored as its own blob, then
 * finalizeChunkedUpload() stitches them together into the final blob and
 * cleans the slices up.
 */
export const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB — safely under both limits

export async function initChunkedUpload(uploadId: string): Promise<void> {
  if (IS_SERVERLESS) return; // blobs are key/value — nothing to prepare
  await fs.mkdir(path.join(UPLOAD_DIR, "chunks", uploadId), { recursive: true });
}

export async function storeChunk(uploadId: string, index: number, data: ArrayBuffer): Promise<void> {
  if (IS_SERVERLESS) {
    const key = `up/${uploadId}/${index}`;
    if (IS_VERCEL) {
      await put(key, data, VERCEL_BLOB_OPTS);
      return;
    }
    await strongStore().set(key, data);
    return;
  }
  await fs.writeFile(path.join(UPLOAD_DIR, "chunks", uploadId, String(index)), Buffer.from(data));
}

/** Numeric index from a chunk blob pathname ("up/<id>/<n>" -> n). */
function chunkIndex(pathname: string, prefix: string): number {
  const n = Number(pathname.slice(prefix.length));
  return Number.isFinite(n) ? n : -1;
}

export async function finalizeChunkedUpload(
  uploadId: string,
  count: number,
  filename: string
): Promise<string> {
  const ext = path.extname(filename || "").toLowerCase() || "";
  const safe = `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  if (IS_SERVERLESS) {
    const prefix = `up/${uploadId}/`;

    if (IS_VERCEL) {
      const listed = await blobList({ prefix, limit: 1000 });
      const byIndex = new Map<number, string>();
      for (const b of listed.blobs) {
        const idx = chunkIndex(b.pathname, prefix);
        if (idx >= 0) byIndex.set(idx, b.url);
      }
      const parts: Buffer[] = [];
      for (let i = 0; i < count; i++) {
        const url = byIndex.get(i);
        if (!url) throw new Error(`chunk ${i} missing`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`chunk ${i} fetch failed: ${res.status}`);
        parts.push(Buffer.from(await res.arrayBuffer()));
      }
      await put(safe, Buffer.concat(parts), VERCEL_BLOB_OPTS);
      // best-effort cleanup of the slice blobs
      for (const url of byIndex.values()) {
        try {
          await blobDel(url);
        } catch {
          // slice may already be gone — fine
        }
      }
      return safe;
    }

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
 * Handles: Vercel blob URLs, the /api/media/<name> scheme, and the legacy
 * /uploads/<name> scheme (old rows). External cloud URLs are ignored.
 *
 * SAFETY: the whole operation is capped at 8s so delete APIs ALWAYS answer
 * in time; a briefly lingering blob is harmless (the DB row drives the UI).
 */
export async function removeUploadedFile(url: string): Promise<void> {
  if (!url) return;
  let name: string | null = null;
  if (url.startsWith("/api/media/")) name = url.slice("/api/media/".length);
  else if (url.startsWith("/uploads/")) name = url.slice("/uploads/".length);
  name = name ? path.basename(name) : null;
  if (name && (name.startsWith(".") || name.includes("/") || name.includes("\\"))) return;

  const work = (async () => {
    if (IS_SERVERLESS && IS_VERCEL) {
      try {
        if (url.startsWith("http")) {
          // full Vercel Blob URL (from saveUploadedFile) — direct delete
          await blobDel(url);
        } else if (name) {
          // legacy path — resolve to a blob URL first (old rows may not map
          // to any blob; that's fine, the DB row drives the UI)
          const meta = await blobHead(name).catch(() => null);
          if (meta?.url) await blobDel(meta.url);
        }
      } catch (err) {
        console.error("[coocoo:upload] blob delete failed:", name ?? url, err);
      }
      return;
    }
    if (IS_SERVERLESS) {
      if (!name) return; // external URL — nothing stored locally
      try {
        await getStore(BLOBS_STORE).delete(name);
      } catch (err) {
        console.error("[coocoo:upload] blob delete failed:", name, err);
      }
      return;
    }
    if (!name) return; // external URL — nothing stored locally
    try {
      await fs.unlink(path.join(UPLOAD_DIR, name));
    } catch {
      // file may already be gone (or a legacy static asset)
    }
  })();

  const budget = new Promise<void>((resolve) => setTimeout(resolve, 8000));
  await Promise.race([work, budget]);
}
