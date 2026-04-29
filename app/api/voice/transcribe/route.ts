import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const CLEANUP_SYSTEM_PROMPT = `你是中文語音逐字稿清理助手。把口述轉寫整理成乾淨可讀的文字。

規則：
1. 移除贅字（嗯、呃、那個、就是、然後、欸）
2. 處理自我修正：「我想要去...應該說我想要先去」→ 只保留最終意思「我想要先去」
3. 修正明顯的同音錯字（依上下文判斷）
4. 保持原意，不要擅自延伸或潤飾
5. 不加標題、引言、結語
6. 保持口語自然，不要改成書面語
7. 標點符號自然斷句

只輸出清理後的文字，不要解釋。`;

export async function POST(req: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY 未設定，無法使用 Whisper。請改用瀏覽器內建模式。" },
      { status: 503 },
    );
  }

  let audio: File;
  let cleanup: boolean;
  let language: string;
  try {
    const form = await req.formData();
    const a = form.get("audio");
    if (!(a instanceof File)) {
      return NextResponse.json({ error: "audio file required" }, { status: 400 });
    }
    audio = a;
    cleanup = form.get("cleanup") === "true";
    language = (form.get("language") as string) || "zh";
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const whisperForm = new FormData();
  whisperForm.append("file", audio);
  whisperForm.append("model", "whisper-1");
  whisperForm.append("language", language);
  whisperForm.append("response_format", "json");

  const whisperRes = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: whisperForm,
    },
  );

  if (!whisperRes.ok) {
    const errText = await whisperRes.text();
    return NextResponse.json(
      { error: `Whisper 失敗: ${errText.slice(0, 200)}` },
      { status: whisperRes.status },
    );
  }

  const { text: rawText } = (await whisperRes.json()) as { text: string };

  if (!cleanup || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ text: rawText, raw: rawText, cleaned: false });
  }

  if (!rawText.trim()) {
    return NextResponse.json({ text: "", raw: "", cleaned: false });
  }

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: CLEANUP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawText }],
    });
    let cleaned = rawText;
    for (const block of msg.content) {
      if (block.type === "text") {
        cleaned = block.text.trim() || rawText;
        break;
      }
    }
    return NextResponse.json({ text: cleaned, raw: rawText, cleaned: true });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      text: rawText,
      raw: rawText,
      cleaned: false,
      cleanupError: errMsg.slice(0, 200),
    });
  }
}
