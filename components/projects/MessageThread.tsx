"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { ProjectMessage } from "@/lib/projects/fetch-quote-data";

interface Props {
  projectId: string;
  initialMessages: ProjectMessage[];
  /** 'customer' = 客戶版（用 token 經 API route 寫入）；'craftsman' = 師傅版（直接 supabase RLS） */
  mode: "customer" | "craftsman";
  /** mode='customer' 時必填 */
  token?: string;
}

export function MessageThread({ projectId, initialMessages, mode, token }: Props) {
  const t = useTranslations("messageThread");
  const [messages, setMessages] = useState<ProjectMessage[]>(initialMessages);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const formatTime = (iso: string): string => {
    const d = new Date(iso);
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (sameDay) return t("todayTpl", { time });
    return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      if (mode === "customer") {
        if (!token) throw new Error(t("errMissingToken"));
        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            senderName: name.trim() || null,
            content: content.trim(),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
        }
      } else {
        const supabase = createClient();
        const { error } = await supabase.from("project_messages").insert({
          project_id: projectId,
          sender_role: "craftsman",
          sender_name: name.trim() || null,
          content: content.trim(),
        });
        if (error) throw error;
      }
      setContent("");
      router.refresh();
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          sender_role: mode,
          sender_name: name.trim() || null,
          content: content.trim(),
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border-2 border-zinc-200 bg-white p-5 sm:p-6 print:hidden">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-lg">💬</span>
        <h2 className="text-base font-semibold text-zinc-900">
          {mode === "customer" ? t("thCustomer") : t("thCraftsman")}
        </h2>
        <span className="text-xs text-zinc-500">({messages.length})</span>
      </div>

      {messages.length > 0 && (
        <ul className="space-y-3 mb-4 max-h-80 overflow-y-auto">
          {messages.map((m) => {
            const mine = m.sender_role === mode;
            return (
              <li
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.sender_role === "customer"
                      ? "bg-sky-50 border border-sky-200 text-sky-900"
                      : "bg-amber-50 border border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="text-[10px] opacity-70 mb-0.5 flex items-baseline gap-1.5">
                    <span className="font-medium">
                      {m.sender_name ||
                        (m.sender_role === "customer"
                          ? t("nicknameCustomer")
                          : t("nicknameCraftsman"))}
                    </span>
                    <span>·</span>
                    <span>{formatTime(m.created_at)}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSend} className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            mode === "customer" ? t("namePhCustomer") : t("namePhCraftsman")
          }
          maxLength={40}
          className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-lg bg-white"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            mode === "customer" ? t("contentPhCustomer") : t("contentPhCraftsman")
          }
          rows={3}
          maxLength={2000}
          className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white resize-y"
        />
        {err && <p className="text-xs text-red-600">{t("errPrefixTpl", { msg: err })}</p>}
        <div className="flex justify-between items-center gap-2">
          <span className="text-[10px] text-zinc-400">{content.length}/2000</span>
          <button
            type="submit"
            disabled={busy || !content.trim()}
            className="px-4 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f] disabled:opacity-50"
          >
            {busy ? t("sendBtnBusy") : t("sendBtnIdle")}
          </button>
        </div>
      </form>
    </section>
  );
}
