import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WebGL Canvas (three.js/r3f) can't survive strict-mode double-mount:
  // the first mount's GL context gets lost, and Chromium refuses to
  // grant a new one to the second mount. Result: blank 透視圖 in dev.
  // Production builds don't double-mount, so this is dev-only.
  reactStrictMode: false,
};

export default nextConfig;
