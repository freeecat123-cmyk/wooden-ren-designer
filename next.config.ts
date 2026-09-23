import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Allow independent local previews without sharing Next's development lock.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // WebGL Canvas (three.js/r3f) can't survive strict-mode double-mount:
  // the first mount's GL context gets lost, and Chromium refuses to
  // grant a new one to the second mount. Result: blank 透視圖 in dev.
  // Production builds don't double-mount, so this is dev-only.
  reactStrictMode: false,
  // 🔴 2026-09-24 拿掉了 `deploymentId: process.env.VERCEL_DEPLOYMENT_ID`。
  //
  // 它本來是為了 Skew Protection：使用者手機開著設計頁,期間推了新版 → 下一次動滑桿
  // 發的 RSC 請求打到新版、client 還是舊版 → payload 對不上 → Next 退回整頁硬導航,
  // 也就是「用到一半畫面自己重整」。
  //
  // ⛔ 但真正的路由是 Vercel 專案設定的 Skew Protection 開關在做,那是付費方案的功能,
  //    我們沒開 → 這行**一點作用都沒有**,卻有實測到的代價:
  //    `VERCEL_DEPLOYMENT_ID` 在 **build 時不存在、runtime 才有** →
  //    client bundle 被烙進字串 "undefined"、server 送出的 HTML 帶真值 →
  //    同一支 chunk 出現 `?dpl=undefined` 與 `?dpl=dpl_xxx` 兩種網址 →
  //    23 支 JS 裡 9 支被**下載兩次**。模擬 4G 實測多花約 3 秒。
  //    (舊註解寫「值是 undefined,行為與現在完全相同」—— 那句是錯的,就是這個 bug 的來源。)
  //
  // 📌 哪天真的買了付費方案並在 Settings → Advanced 開啟 Skew Protection,再把這行加回來:
  //    那時 build 時就拿得到 id,前後端一致,才會只有好處沒有壞處。
  //    「畫面自己重整」的另一半防護 components/RscFetchRetry.tsx 不受影響,照常運作。
  // subset-font / harfbuzzjs 的 .wasm 在 `next dev --webpack` 下打包會壞
  // （Module parse failed: WebAssembly module not flagged），導致
  // /api/pdf-font 在本機 dev 回 500。標記為外部套件、runtime 用原生
  // require 載入即可繞開，不影響 build（build 走 Turbopack）。
  serverExternalPackages: ["subset-font", "harfbuzzjs"],
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
    // CNC 刀路工具是 1MB 單檔 HTML，放在非公開的 lib/cnc/ 由 /api/cnc-tool route
    // handler 驗權限後 readFile 吐出（硬 gating）。放 /api 下是為了被 middleware
    // matcher 排除（locale-agnostic）。Vercel 預設只 trace 程式碼引用到的檔，
    // 明確列出讓部署帶上這份 HTML。
    "/api/cnc-tool": ["./lib/cnc/cnc-tool.html"],
    // 字型全字庫只在伺服器端用（子集化），Vercel 預設不會 trace 到，明確列出。
    "/api/pdf-font": ["./lib/fonts/*.ttf"],
  },
  async redirects() {
    return [
      {
        // CNC 工具產品化前是公開孤兒頁 /cnc.html；改硬 gating 後檔案已移出
        // /public，舊網址一律導到銷售頁 /cnc（redirects 先於 filesystem 生效）。
        source: "/cnc.html",
        destination: "/cnc",
        permanent: false,
      },
    ];
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

export default withNextIntl(nextConfig);
