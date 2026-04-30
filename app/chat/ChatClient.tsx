"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 木頭仁 AI 木工大師 · 客服 chat UI
 *
 * 對 /api/wood-master 送 messages 陣列，streaming 接 token。
 * 嵌入 widget 也共用這個 component（透過 ?embed=1 query 參數切換樣式）。
 */

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "桌鋸 kickback 怎麼防？",
  "6 分板實際是幾 mm？",
  "鳩尾榫角度 1:6 跟 1:8 怎麼選？",
  "亞麻仁油布為什麼會自燃？",
  "Wegner Y 椅是不是抄明式圈椅？",
  "蒸彎要蒸多久？1 hour per inch 怎麼算？",
];

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isEmbed, setIsEmbed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ?embed=1 → 嵌入模式（無外框、最小 chrome）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsEmbed(params.get("embed") === "1");
  }, []);

  // 健康檢查 + 抓今日剩餘
  useEffect(() => {
    fetch("/api/wood-master")
      .then((r) => r.json())
      .then((data) => {
        setAvailable(data.available);
        setRemaining(data.rateLimit?.remaining ?? null);
      })
      .catch(() => setAvailable(false));
  }, []);

  // 自動滾到最底
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;
    setError(null);

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // 先放一個空的 assistant 訊息，stream 進來時 append
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/wood-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const remHeader = res.headers.get("X-Rate-Remaining");
      if (remHeader) setRemaining(Number(remHeader));

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "未知錯誤" }));
        setError(errBody.error ?? `HTTP ${res.status}`);
        // 把空白 assistant 拿掉
        setMessages((prev) => prev.slice(0, -1));
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("無法讀取串流");

      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知錯誤";
      setError(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function reset() {
    setMessages([]);
    setError(null);
    setInput("");
    textareaRef.current?.focus();
  }

  if (available === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center text-zinc-600">
          <h1 className="text-xl font-semibold mb-2">AI 木工大師暫不可用</h1>
          <p className="text-sm">
            服務尚未配置 ANTHROPIC_API_KEY，請聯絡管理員。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isEmbed
          ? "min-h-screen flex flex-col bg-white"
          : "min-h-screen flex flex-col bg-[#fafaf7]"
      }
    >
      {!isEmbed && (
        <header className="border-b border-zinc-200 bg-white px-4 py-3 sm:px-8">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-zinc-900">
                🪵 木頭仁 AI 木工大師
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                榫卯 / 木材 / 塗裝 / 安全 / 機械 / 修補 / 明式 / Windsor / 雕刻 / 車旋
              </p>
            </div>
            <div className="flex items-center gap-3">
              {remaining !== null && (
                <span className="text-xs text-zinc-500">
                  今日剩 {remaining} 題
                </span>
              )}
              {messages.length > 0 && (
                <button
                  onClick={reset}
                  className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1 rounded border border-zinc-200"
                >
                  重新對話
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-8"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-zinc-500 py-12">
              <div className="text-3xl mb-3">🪚</div>
              <p className="text-sm mb-6">
                我是木頭仁的 AI 分身。
                <br />
                木工問題我來答（19 份知識庫 / 13952 行）
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left text-sm text-zinc-700 px-3 py-2 rounded-lg bg-white border border-zinc-200 hover:border-amber-700 hover:bg-amber-50 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] bg-amber-700 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap break-words"
                    : "max-w-[90%] bg-white border border-zinc-200 text-zinc-900 rounded-2xl rounded-tl-sm px-4 py-3 text-sm whitespace-pre-wrap break-words leading-relaxed"
                }
              >
                {m.content || (
                  <span className="text-zinc-400 italic">思考中⋯</span>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-4 py-3 sm:px-8">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex gap-2 items-end"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? "回答中⋯" : "問木工題目，例：6 分板幾 mm？"}
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700 disabled:bg-zinc-100"
            style={{ maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="bg-amber-700 hover:bg-amber-800 disabled:bg-zinc-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {streaming ? "⋯" : "送出"}
          </button>
        </form>
        {!isEmbed && (
          <p className="max-w-3xl mx-auto mt-2 text-[10px] text-zinc-400 text-center">
            AI 答案僅供參考。涉及安全或結構請以實際工法書 / 廠商說明為準。
            <br />
            Powered by Claude Haiku 4.5 · 木頭仁木匠學院出品
          </p>
        )}
      </footer>
    </div>
  );
}
