import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Pin the workspace root to THIS repo. A stray lockfile in a parent directory
// (e.g. ~/package-lock.json) otherwise makes Next infer the wrong root and warn
// during build/lint; pinning it keeps file tracing deterministic.
const repoRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "fal.media" }, { protocol: "https", hostname: "*.fal.media" }],
  },
};

export default nextConfig;
