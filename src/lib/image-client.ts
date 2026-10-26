/**
 * Browser-side photo helper — photo nu chota karke data URL bana denda hai.
 *
 * Kyun? Server-side upload (Vercel Blob) layi BLOB_READ_WRITE_TOKEN chahida,
 * jehda set nahi hai — is layi upload API 500 dendi c. Eh helper photo nu
 * BROWSER ch hi resize karke base64 data URL bana denda hai, jehnu seedha
 * DB (Setting/News/Ad) vich save kitta ja sakda hai. Koi server storage nahi
 * chahida — Vercel, Netlify, local sab te kaam karda hai.
 *
 * - maxDim: vaddi side di limit (px) — artist photo 512, banner 1024
 * - quality: JPEG compression (0.82 default)
 * - Result: ~20-150KB data URL — DB TEXT ch aaram naal save ho janda hai
 */

/** File nu raw data URL padho (bina resize) */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("File padhi nahi ja rahi"));
    r.readAsDataURL(file);
  });
}

/** Load an image element from a File (SVG-safe: <img> handles SVG better than createImageBitmap) */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Photo load nahi hoi"));
    img.src = src;
  });
}

/**
 * Photo → resized JPEG data URL. Resize fail hoya ta raw data URL (no resize).
 * GIF/SVG vi chalde ne (GIF da pehla frame, SVG as-is render hoke).
 */
export async function fileToDataUrl(
  file: File,
  maxDim = 512,
  quality = 0.82
): Promise<string> {
  const raw = await readAsDataUrl(file);
  if (!raw) throw new Error("Photo khali hai");
  // SVG nu resize nahi karde — as-is data URL (vector, apne aap chota render hunda)
  if (/\.svg$/i.test(file.name || "") || raw.startsWith("data:image/svg")) return raw;

  try {
    const img = await loadImg(raw);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return raw;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    // choti photo pehlan ton — resize di lor nahi, par JPEG re-encode size ghata sakda
    if (scale >= 1 && raw.length < 180_000) return raw;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", quality);
    // safety: resize naal vadi hoya ta raw vapis (png transparency rare case)
    return out.length < raw.length ? out : raw;
  } catch {
    return raw; // resize fail — chalde da data URL
  }
}
