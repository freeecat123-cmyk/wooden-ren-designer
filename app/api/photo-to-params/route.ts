import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/**
 * 「📷 照片轉設計」端點。
 *
 * 客戶端送一張家具照（壓縮過的 base64 jpeg），服務端用 Claude Haiku 4.5
 * vision 解析 → 回家具種類 / 尺寸估值 / 木種推測 / 風格 / 腳形等 designer
 * 參數 JSON。前端套用 → router.push 到 `/design/<category>?...`。
 *
 * 重要：尺寸是「估的」不是「量的」（沒尺）。回傳含 confidence 欄位提醒
 * 使用者，dimensions 是 best-guess 不是真值。
 *
 * Caller：components/design/PhotoToParamsButton.tsx
 */

const VALID_CATEGORIES = [
  "stool", "bench", "tea-table", "low-table", "side-table", "open-bookshelf",
  "chest-of-drawers", "shoe-cabinet", "display-cabinet", "dining-table", "desk",
  "dining-chair", "wardrobe", "bar-stool", "media-console", "nightstand",
  "round-stool", "round-tea-table", "round-table", "pencil-holder", "bookend",
  "photo-frame", "tray", "dovetail-box", "wine-rack", "coat-rack",
] as const;

const VALID_STYLES = [
  "shaker", "mid-century", "mission", "ming", "windsor",
  "industrial", "japanese", "chippendale",
] as const;

interface PhotoResponse {
  category: string;
  length: number;
  width: number;
  height: number;
  material?: string;
  style?: string;
  legShape?: string;
  legSize?: number;
  rationale: string;
  confidence: "high" | "medium" | "low";
  warnings?: string[];
}

const SYSTEM_PROMPT = `你是台灣 woodworking YouTuber 木頭仁的家具識別助手。使用者上傳一張家具照，你要回出可以丟進「木頭仁家具設計器」的 JSON 參數。

可選 category（必填，只能挑一個）：
${VALID_CATEGORIES.join(", ")}

可選 style（盡量挑、不確定可省略）：
${VALID_STYLES.join(", ")}

可選 material（推測即可，例：oak / walnut / cherry / maple / pine / teak / douglas-fir / ash / hickory / 其他常見）

可選 legShape（box / tapered / splayed / round / 其他依 category 不同省略）

回傳純 JSON（不要包 markdown code fence）：
{
  "category": "<必填>",
  "length": <估的 mm 整數>,
  "width": <估的 mm 整數>,
  "height": <估的 mm 整數>,
  "material": "<可選>",
  "style": "<可選>",
  "legShape": "<可選>",
  "legSize": <可選 mm 整數>,
  "rationale": "100-200 字描述為什麼這樣判斷（看到什麼線索）",
  "confidence": "high | medium | low",
  "warnings": ["<可選 0-3 條，例：照片角度只看到正面、座面材質模糊等>"]
}

判斷原則：
1. 尺寸用「業界標準範圍」推：餐桌通常 1500-2000×750-900×720-760、餐椅 450×450×850-900、書架 800×300×1800
2. 不確定的欄位寧可省略也不要瞎猜（material/style 信心不夠就 omit）
3. confidence 嚴格自評：能直接看清木紋+腳形+整體 = high；只看到大致輪廓 = medium；模糊/側角 = low
4. category 一定要從清單挑、不能自創
5. 如果照片裡明顯不是家具或看不清楚，category 仍要回最接近的並把 confidence 設 low + warnings 說明`;

export function GET() {
  return NextResponse.json({ available: !!process.env.ANTHROPIC_API_KEY });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { imageBase64: string; mediaType?: string };
    const { imageBase64, mediaType = "image/jpeg" } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "缺 imageBase64" }, { status: 400 });
    }

    // 防爆量：base64 上限 ~6MB（壓縮後 jpeg 應該 <1MB）
    if (imageBase64.length > 6_000_000) {
      return NextResponse.json({ error: "圖檔太大（請壓到 1MB 以下）" }, { status: 413 });
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
      return NextResponse.json({ error: "格式只接受 jpeg/png/webp" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "照片轉設計功能尚未配置 (缺 ANTHROPIC_API_KEY)" },
        { status: 503 },
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "請辨識這張家具照，回 JSON。",
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    let parsed: PhotoResponse;
    try {
      const cleaned = text.replace(/^```json\n?|\n?```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI 回傳格式錯誤", raw: text }, { status: 502 });
    }

    // 驗證 category 在白名單
    if (!parsed.category || !(VALID_CATEGORIES as readonly string[]).includes(parsed.category)) {
      return NextResponse.json(
        { error: `AI 回的 category 不在白名單: ${parsed.category}`, raw: text },
        { status: 502 },
      );
    }

    // style 白名單檢查（容忍空）
    if (parsed.style && !(VALID_STYLES as readonly string[]).includes(parsed.style)) {
      delete parsed.style;
    }

    // 尺寸 sanity check
    for (const k of ["length", "width", "height"] as const) {
      const v = parsed[k];
      if (typeof v !== "number" || v < 50 || v > 5000) {
        return NextResponse.json(
          { error: `尺寸不合理: ${k}=${v}`, raw: text },
          { status: 502 },
        );
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[photo-to-params]", err);
    const msg = err instanceof Error ? err.message : "未知錯誤";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
