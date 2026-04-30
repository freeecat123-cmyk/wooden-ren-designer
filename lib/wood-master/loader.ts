/**
 * 木工大師客服 — 知識檔讀取器
 *
 * 從 lib/wood-master/knowledge/*.md 讀檔，內容塞進 system prompt。
 *
 * Vercel 部署時 next.config.ts 的 outputFileTracingIncludes 已經把這些 md 帶進
 * Lambda bundle，runtime 用 fs.readFile + path.join(process.cwd(), ...) 即可。
 *
 * Cache：Lambda 跨 invocation 會 cold start，但同一 invocation 內 module-level
 * Map 可以重用，所以做簡單 in-memory cache。
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const KNOWLEDGE_DIR = "lib/wood-master/knowledge";

const cache = new Map<string, string>();

export async function loadKnowledge(file: string): Promise<string> {
  const cached = cache.get(file);
  if (cached !== undefined) return cached;
  const fullPath = join(process.cwd(), KNOWLEDGE_DIR, file);
  try {
    const text = await readFile(fullPath, "utf-8");
    cache.set(file, text);
    return text;
  } catch (err) {
    console.error(`[wood-master] 讀檔失敗 ${file}:`, err);
    return ""; // fallback 不擋對話流
  }
}

export async function loadKnowledgeMany(files: string[]): Promise<string> {
  const blocks = await Promise.all(
    files.map(async (f) => {
      const text = await loadKnowledge(f);
      if (!text) return "";
      return `\n\n=========================\n# 知識來源：${f}\n=========================\n\n${text}`;
    }),
  );
  return blocks.filter(Boolean).join("");
}
