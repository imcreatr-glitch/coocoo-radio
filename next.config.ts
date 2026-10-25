import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // libsql native bindings + Netlify Blobs must stay external so they load
  // correctly inside AWS Lambda (Netlify serverless) at runtime.
  serverExternalPackages: ["@libsql/client", "libsql", "@netlify/blobs"],
  /* config options here */
  // Netlify serverless: make sure the Prisma query engines (.so.node) and the
  // seeded SQLite db are packed into every API function bundle — without this
  // some builds drop the engine binary and every /api route 500s.
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/.prisma/client/**",
      "./node_modules/@prisma/client/**",
      "./db/**",
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
