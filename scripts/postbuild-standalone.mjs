/**
 * Post-build helper for LOCAL standalone runs only.
 * Copies static assets into .next/standalone so `bun start` can serve them.
 * On Vercel the platform handles static serving itself and may not produce
 * .next/standalone — so every step here is conditional (never fails CI).
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.log("[postbuild] no .next/standalone — skipping (Vercel handles serving)");
  process.exit(0);
}

for (const [src, dest] of [
  [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
  [path.join(root, "public"), path.join(standalone, "public")],
]) {
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[postbuild] copied ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
}
