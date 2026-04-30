import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WebGL Canvas (three.js/r3f) can't survive strict-mode double-mount:
  // the first mount's GL context gets lost, and Chromium refuses to
  // grant a new one to the second mount. Result: blank 透視圖 in dev.
  // Production builds don't double-mount, so this is dev-only.
  reactStrictMode: false,
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
