import path from "path";

/** True when running inside Netlify serverless functions */
export const IS_NETLIFY = !!process.env.NETLIFY;

/**
 * Where runtime-uploaded media (songs, news images, ad banners/videos) is stored.
 * - Local dev: public/uploads — served statically by Next dev server
 * - Netlify: filesystem is read-only except /tmp, so uploads go to /tmp/uploads
 *   and are served through the /api/media/[name] route
 */
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  (IS_NETLIFY ? "/tmp/uploads" : path.join(process.cwd(), "public", "uploads"));
