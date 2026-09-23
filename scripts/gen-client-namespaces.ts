/**
 * 掃出「client 元件真的用到哪些翻譯命名空間」,產生 lib/i18n/client-namespaces.ts。
 *
 * 為什麼要有這支:整包翻譯字典 243KB 被塞進**每一頁**的 HTML,gzip 後佔傳輸量
 * 的 69%,而其中 9 成以上是那一頁根本用不到的(後台、問卷、天花板算料文案全都跟著送)。
 * 只送 client 用得到的那些 → gzip 少 35KB(翻譯量的 47%)。
 *
 * ⚠️ 這份名單**不可以手寫**。漏一個命名空間,畫面上就會直接顯示 key 名稱
 *    (next-intl 的 fallback 行為),而且只在那個元件被 render 到才看得出來。
 *    改完 client 元件的 useTranslations 就重跑這支。
 *
 * 用法:npx tsx scripts/gen-client-namespaces.ts        # 產生
 *      npx tsx scripts/gen-client-namespaces.ts --check # CI 檢查有沒有過期
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "lib/i18n/client-namespaces.ts");

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(p, acc);
    } else if (/\.(tsx|ts)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = ["app", "components", "hooks", "lib"].flatMap((d) => walk(path.join(ROOT, d)));
const used = new Set<string>();
const rootless: string[] = [];

for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  // 只看 client 元件:server 元件的翻譯在伺服器就解完了,不需要進 client payload
  if (!/^\s*["']use client["']/m.test(s.slice(0, 400))) continue;

  // useTranslations("ns") / useTranslations("ns.sub") → 取最上層
  for (const m of s.matchAll(/useTranslations\(\s*["']([A-Za-z0-9_.\-]+)["']/g)) {
    used.add(m[1].split(".")[0]);
  }
  // useTranslations() 不帶命名空間 → 從它實際呼叫的 key 反推最上層
  if (/useTranslations\(\s*\)/.test(s)) {
    rootless.push(path.relative(ROOT, f));
    for (const m of s.matchAll(/\b(?:t|tRoot)(?:\.raw|\.rich|\.markup|\.has)?\(\s*[`"']([A-Za-z0-9_.\-]+)/g)) {
      used.add(m[1].split(".")[0]);
    }
  }
}

const messages = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/zh-TW.json"), "utf8"));
const top = new Set(Object.keys(messages));
const list = [...used].filter((n) => top.has(n)).sort();
const unknown = [...used].filter((n) => !top.has(n)).sort();

const body = `// 這個檔案由 scripts/gen-client-namespaces.ts 產生,不要手改。
// 改完 client 元件的 useTranslations 之後重跑:npx tsx scripts/gen-client-namespaces.ts
//
// 為什麼存在:整包翻譯字典會被塞進每一頁的 HTML(gzip 後佔傳輸量約 69%),
// 其中九成以上是那一頁用不到的。只送 client 元件真的會讀的命名空間。
//
// ⚠️ 漏一個 → 畫面直接顯示 key 名稱,而且只在那個元件被 render 到才看得出來。
//    所以名單一律由掃描產生,不手寫。
//
// 掃描結果:client 元件用到 ${list.length} 個命名空間 /
//          messages 共 ${top.size} 個 / 省下 ${top.size - list.length} 個不送。
${rootless.length ? `// 不帶命名空間的 useTranslations()(已從實際 key 反推):\n${rootless.map((f) => `//   - ${f}`).join("\n")}\n` : ""}
export const CLIENT_NAMESPACES = [
${list.map((n) => `  ${JSON.stringify(n)},`).join("\n")}
] as const;

/** 從整包 messages 挑出 client 需要的那些 */
export function pickClientMessages<T extends Record<string, unknown>>(all: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const ns of CLIENT_NAMESPACES) if (ns in all) out[ns] = all[ns as keyof T];
  return out as Partial<T>;
}
`;

if (process.argv.includes("--check")) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (cur !== body) {
    console.error("⛔ lib/i18n/client-namespaces.ts 過期了。跑一次 `npx tsx scripts/gen-client-namespaces.ts` 再 commit。");
    process.exit(1);
  }
  console.log(`✅ client 命名空間名單是最新的(${list.length} 個)。`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);
  console.log(`✅ 產生 ${path.relative(ROOT, OUT)}:${list.length} / ${top.size} 個命名空間`);
  if (unknown.length) console.log(`   (略過 ${unknown.length} 個不是最上層命名空間的 key:${unknown.slice(0, 6).join(", ")}…)`);
}
