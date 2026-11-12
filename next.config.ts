import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the dev server through forwarded/preview hostnames (e.g. on a phone).
  allowedDevOrigins: ["*.claude.ai", "*.anthropic.com", "*.local"],
  // Separate build dir lets e2e builds run while the dev server is up.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: { unoptimized: true },
  serverExternalPackages: ["probe-image-size"],
};

export default nextConfig;
