import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WebGL Canvas (three.js/r3f) can't survive strict-mode double-mount:
  // the first mount's GL context gets lost, and Chromium refuses to
  // grant a new one to the second mount. Result: blank 透視圖 in dev.
  // Production builds don't double-mount, so this is dev-only.
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: [
      "three",
      "@react-three/drei",
      "@react-three/fiber",
      "three-bvh-csg",
      "lucide-react",
    ],
  },
  // Next 16 預設用 Turbopack 做 build；下方保留的 webpack 設定（dev 檔案監聽）
  // 在沒有 turbopack 設定時會被 Next 16 視為錯誤而中斷 build。
  // 設一個空的 turbopack 物件即明示「webpack 設定是刻意保留的」，build 照常用
  // Turbopack 進行。webpack 設定僅在 `next dev --webpack` 時才生效。
  turbopack: {},
  // dev：檔案監聽器不要遞迴進 .claude/（內含 git worktrees + 各自的
  // node_modules / .next，可達數 GB；worktree 的 dev server 還會持續寫
  // .next）→ 否則主 dev server 監聽迴圈永不收斂、idle 也吃滿 1.5+ 核。
  // 一併排除 .git / .next / node_modules。
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: /[/\\](?:\.git|\.next|node_modules|\.claude)[/\\]/,
      };
    }
    return config;
  },
  // 木工大師客服 bot 在 runtime 從 lib/wood-master/knowledge/*.md 讀知識，
  // Vercel 預設只 trace 程式碼引用到的檔案；明確列出讓部署帶上這 19 份 md。
  outputFileTracingIncludes: {
    "/api/wood-master": ["./lib/wood-master/knowledge/**/*.md"],
  },
  async headers() {
    return [
      {
        // /chat?embed=1 要被 woodenren.com 用 iframe 嵌入，不能擋
        source: "/chat",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://woodenren.com https://*.woodenren.com https://woodenrenclass.com https://*.woodenrenclass.com",
          },
        ],
      },
      {
        // widget script 要可被任何網站 fetch
        source: "/widget/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
