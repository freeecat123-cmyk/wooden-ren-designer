import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { selectKnowledgeFiles } from "@/lib/wood-master/router";
import { loadKnowledgeMany } from "@/lib/wood-master/loader";
import { getRedis } from "@/lib/shorten/redis";

/**
 * 木工大師客服 — 對外公開的 chat 端點。
 *
 * 流程：
 * 1. 抓 IP，查 Upstash 今日已問次數，超過 30 次就 429
 * 2. 從最後一條使用者訊息抓 keyword，挑 1-3 份知識檔
 * 3. 把知識塞 system prompt，連同對話歷史送給 Claude Haiku 4.5
 * 4. Streaming 把 token 一個一個吐回前端
 *
 * 安全：
 * - 沒設 ANTHROPIC_API_KEY 就 503，前端可以靠 GET 健康檢查藏掉按鈕
 * - 訊息上限 20 條（防灌爆）
 * - 單條訊息上限 2000 字（防 prompt injection 灌爆）
 * - rate limit 沒接 Redis 時 fallback 為「不限」（local dev 用）
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  messages: ChatMessage[];
}

const SYSTEM_PROMPT_CORE = `你是「木頭仁 Wooden Ren」的 AI 分身——台灣木工 YouTuber、木匠學院創辦人。回答木工問題時：

語氣：
- 全程繁體中文，像木頭仁本人講話
- 職人溫度 + 真實口吻、第一人稱「我」、短句交錯
- 不要罐頭感、不要客套句尾「希望對你有幫助」之類

判斷原則：
1. **以下方知識來源為主**——只引用知識檔出現過的具體數字、書名、人名、出處，不要自己編
2. **找不到答案就誠實說「這題我這份知識庫沒整理」**，並推薦使用者從哪份書/影片找答案
3. **安全題優先**（kickback、刀具、塗料毒性、油布自燃）→ 答錯有風險，寧可保守
4. **台灣在地 context**：台尺/分/坪、6 分=18mm、紅檜/相思木、阿里山/太平山、業界口頭句型
5. **木匠學院推坑**：客戶問「我想自己學」可以軟提木匠學院（不要硬推，氛圍對才提）

回答結構：
- 短答（2-3 句）→ 細節（如果題目需要）→ 出處（哪本書 / 哪份知識檔 §章節）
- 不寫「以下是...」「這個問題...」之類開場白，直接回答
- 結尾不寫「希望對你有幫助」之類罐頭

不要：
- 自己編書名、人名、年份、毫米數字
- 給跟知識檔牴觸的建議
- 推薦你不確定台灣買得到的工具品牌
- 講你不會的事情就裝會`;

const RATE_LIMIT_PER_DAY = 30;

function getClientIp(req: NextRequest): string {
  // Vercel 會在 x-forwarded-for 帶 IP，可能多個逗號分隔，取第一個
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

async function checkRateLimit(ip: string): Promise<{ ok: boolean; remaining: number }> {
  const redis = getRedis();
  if (!redis) return { ok: true, remaining: RATE_LIMIT_PER_DAY }; // local dev 不限

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `wm:rl:${today}:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    // 第一次設 24hr TTL（多給點 buffer 到隔日換 key）
    await redis.expire(key, 60 * 60 * 25);
  }
  return {
    ok: count <= RATE_LIMIT_PER_DAY,
    remaining: Math.max(0, RATE_LIMIT_PER_DAY - count),
  };
}

/** GET /api/wood-master — 健康檢查 + 今日剩餘次數 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const available = !!process.env.ANTHROPIC_API_KEY;
  let remaining: number | null = null;
  try {
    const redis = getRedis();
    if (redis) {
      const today = new Date().toISOString().slice(0, 10);
      const key = `wm:rl:${today}:${ip}`;
      const used = (await redis.get<number>(key)) ?? 0;
      remaining = Math.max(0, RATE_LIMIT_PER_DAY - used);
    }
  } catch {
    // 忽略 Redis 失敗
  }
  return NextResponse.json({
    available,
    rateLimit: { perDay: RATE_LIMIT_PER_DAY, remaining },
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI 客服尚未配置 (缺 ANTHROPIC_API_KEY)" },
      { status: 503 },
    );
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages 必填" }, { status: 400 });
  }
  if (messages.length > 20) {
    return NextResponse.json({ error: "對話過長，請重新開始" }, { status: 400 });
  }
  for (const m of messages) {
    if (!m.role || !m.content) {
      return NextResponse.json({ error: "messages 欄位錯誤" }, { status: 400 });
    }
    if (m.content.length > 2000) {
      return NextResponse.json({ error: "單則訊息超過 2000 字" }, { status: 400 });
    }
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `今日已達上限 (${RATE_LIMIT_PER_DAY} 題/日)，明天再來。`,
        rateLimited: true,
      },
      { status: 429 },
    );
  }

  // 找最後一條 user 訊息抓 keyword
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUser?.content ?? "";
  const files = selectKnowledgeFiles(query);
  const knowledge = await loadKnowledgeMany(files);

  const systemPrompt = `${SYSTEM_PROMPT_CORE}\n\n---\n\n# 知識庫（本次相關片段）\n${knowledge}`;

  const client = new Anthropic({ apiKey });

  // Streaming：用 ReadableStream 把 token 流回前端
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const response = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        console.error("[wood-master] stream error:", err);
        const msg = err instanceof Error ? err.message : "未知錯誤";
        controller.enqueue(encoder.encode(`\n\n[錯誤] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Knowledge-Files": files.join(","),
      "X-Rate-Remaining": String(rl.remaining),
    },
  });
}
