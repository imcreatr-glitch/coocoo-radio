import path from "path";

/**
 * True when running inside a serverless function.
 * Netlify/Vercel functions run on AWS Lambda, which sets
 * AWS_LAMBDA_FUNCTION_NAME / AWS_EXECUTION_ENV — plus explicit platform
 * flags (NETLIFY / VERCEL) as a fast path.
 */
export const IS_SERVERLESS = !!(
  process.env.VERCEL ||
  process.env.NETLIFY ||
  process.env.NETLIFY_DEV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.AWS_EXECUTION_ENV
);

/** Back-compat alias */
export const IS_NETLIFY = IS_SERVERLESS;

/**
 * Where runtime-uploaded media (songs, news images, ad banners/videos) is stored.
 * - Local dev: public/uploads — served statically by Next dev server
 * - Serverless: filesystem is read-only except /tmp, so uploads go to /tmp/uploads
 *   and are served through the /api/media/[name] route
 */
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  (IS_SERVERLESS ? "/tmp/uploads" : path.join(process.cwd(), "public", "uploads"));
