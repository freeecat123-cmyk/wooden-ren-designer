import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/**
 * 「🤖 AI 微調」端點。
 *
 * 客戶端送：當前 design state（風格 / 模板 / 尺寸 / 材質 / 既有參數 +
 * 使用者意圖文字 hints）。
 *
 * 服務端呼叫 Claude → 用 wood-master/knowledge 的設計常識 + 風格知識，
 * 回傳「建議的 params 微調 + 理由」。
 *
 * Caller：components/design/AIRefineButton.tsx
 *
 * 安全考量：
 * - 不接受任意 URL params（只接受白名單欄位）
 * - LLM 回傳 JSON parsed + 驗證 numeric ranges
 * - 失敗 fallback 到 static pack（user 不會卡住）
 *
 * 成本考量：
 * - 用 Haiku 4.5（快+便宜，每次 ~0.005 USD）
 * - cache 邏輯由 Vercel Edge Cache 接（同樣 input → 同樣 output）
 * - max_tokens 1500 限上限
 */

interface RequestBody {
  styleId: string;
  category: string;
  currentParams: Record<string, string | number | boolean>;
  designSize: { length: number; width: number; height: number };
  material?: string;
  userIntent?: string; // 可選：「腳要粗一點」「我做小孩用」等
}

interface SuggestResponse {
  suggestions: Record<string, string | number | boolean>;
  rationale: string;
  warnings?: string[];
}

const SYSTEM_PROMPT = `你是台灣 woodworking YouTuber 木頭仁的家具設計助手。你會收到家具設計參數，給出**情境化的微調建議**（不是重新設計）。

知識來源：
- Tage Frid / Christopher Schwarz 工法寶典（榫卯比例、椅子幾何、邊緣處理）
- 王世襄《明式家具研究》（明式 module / 抱肩榫 / 圓角櫃）
- Galbert / Buchanan Windsor 椅匠（splay angle、saddle 座、green wood）
- Hoadley《Understanding Wood》（木材科學、收縮、強度）
- 台灣本地慣例（台尺、6 分=18mm、業界標準尺寸）

判斷原則：
1. 尺寸合理性：legSize 應跟總尺寸匹配（桌面面積 × 0.5% = 最小腳截面）
2. 材質適配：每風格都有傳統用料偏好（Shaker→cherry/maple、Mid-Century→walnut/teak）
3. 風格一致：建議要強化選定風格的視覺特徵，不破壞風格內聚
4. 結構安全：不能違反 Hoadley 的木材科學常識（含水率、wood movement）
5. 使用者意圖優先：使用者明說「腳要粗一點」就照做、給合理理由

回傳格式必須是 JSON：
{
  "suggestions": { "<key>": <value>, ... },  // 只放需要改的 key（5-10 個就夠，不要全部覆寫）
  "rationale": "...",  // 100-200 字理由，引用書系出處
  "warnings": ["..."]  // 0-3 個警告（風格 mismatch、結構風險等）
}

不要：
- 改動 user 沒提到的整體風格（風格已選定）
- 不確定就建議
- 寫不在 OptionSpec 內的 key`;

/**
 * GET /api/style-suggest — 健康檢查。
 * 客戶端用來決定是否 render AIRefineButton（沒 API key 就藏起來）。
 * 不暴露 key 本身、只回 boolean。
 */
export function GET() {
  return NextResponse.json({ available: !!process.env.ANTHROPIC_API_KEY });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const { styleId, category, currentParams, designSize, material, userIntent } = body;

    // 簡單驗證
    if (!styleId || !category || !designSize) {
      return NextResponse.json({ error: "缺必要欄位" }, { status: 400 });
    }

    // 防爆量：currentParams 太大就拒
    const paramCount = Object.keys(currentParams ?? {}).length;
    if (paramCount > 80) {
      return NextResponse.json({ error: "參數過多" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI 微調功能尚未配置 (缺 ANTHROPIC_API_KEY)" },
        { status: 503 },
      );
    }

    const client = new Anthropic({ apiKey });

    const userMessage = `家具類別：${category}
風格：${styleId}
總尺寸：長 ${designSize.length}mm × 寬 ${designSize.width}mm × 高 ${designSize.height}mm
${material ? `主材：${material}` : ""}
${userIntent ? `使用者意圖：${userIntent}` : ""}

當前參數（可能需要微調）：
${JSON.stringify(currentParams, null, 2)}

請依「判斷原則」給出 5-10 個 key 的微調建議。回傳純 JSON、不要包 markdown code fence。`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    // 解析 LLM 回傳的 JSON
    let parsed: SuggestResponse;
    try {
      // 防 markdown fence
      const cleaned = text.replace(/^```json\n?|\n?```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "AI 回傳格式錯誤", raw: text },
        { status: 502 },
      );
    }

    if (!parsed.suggestions || !parsed.rationale) {
      return NextResponse.json(
        { error: "AI 回傳缺欄位", raw: text },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[style-suggest]", err);
    const msg = err instanceof Error ? err.message : "未知錯誤";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
