import path from "path";

export const IS_SERVERLESS = !!(
  process.env.NETLIFY ||
  process.env.NETLIFY_DEV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.AWS_EXECUTION_ENV
);

/** Back-compat alias */
export const IS_NETLIFY = IS_SERVERLESS;

export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  (IS_SERVERLESS ? "/tmp/uploads" : path.join(process.cwd(), "public", "uploads"));
