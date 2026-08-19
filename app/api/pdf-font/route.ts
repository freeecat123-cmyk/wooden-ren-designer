// 依「本次實際要渲染的字元」即時子集化中文字型，供前端嵌進 PDF。
// 全字庫只留伺服器端；實測 6,924.6KB 的字型子集後約數十 KB（依字元數而定）。
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import subsetFont from "subset-font";
import { checkIpRateLimit, getClientIp } from "@/lib/api/ip-rate-limit";

export const runtime = "nodejs";

const FONT_PATH = join(process.cwd(), "lib/fonts/NotoSansTC-Regular.ttf");
/** 一律附帶的基本字元，省得每次都要前端帶。 */
const ALWAYS = "0123456789.,-×:()／mm";
/** 單張樣板實測字元集只有 47 個字，整包遠不到這個數；超過視為異常請求。 */
const MAX_CHARS = 2000;
/** 一次匯出只打這支 API 一次，200/日/IP 綽綽有餘。 */
const PDF_FONT_PER_DAY = 200;

export async function POST(req: Request) {
  const rl = await checkIpRateLimit({
    prefix: "pdf-font",
    ip: getClientIp(req),
    perDay: PDF_FONT_PER_DAY,
  });
  if (!rl.ok) {
    return new Response("rate_limited", { status: 429 });
  }

  let chars = "";
  try {
    const body = (await req.json()) as { chars?: unknown };
    const raw = body.chars ?? "";
    if (typeof raw !== "string") {
      return new Response("chars must be a string", { status: 400 });
    }
    chars = raw;
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!chars.trim()) return new Response("chars required", { status: 400 });
  if (chars.length > MAX_CHARS) {
    return new Response("chars too long", { status: 400 });
  }

  const wanted = Array.from(new Set((chars + ALWAYS).split(""))).sort().join("");
  const etag = createHash("sha1").update(wanted).digest("hex");

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  const full = await readFile(FONT_PATH);
  const sub = await subsetFont(full, wanted, { targetFormat: "truetype" });

  return new Response(new Uint8Array(sub), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      ETag: etag,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
