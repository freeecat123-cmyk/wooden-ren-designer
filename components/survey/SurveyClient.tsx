"use client";

import { useState } from "react";
import Link from "next/link";
import type { SurveyConfig, Question } from "@/lib/survey/configs";

interface Props {
  config: SurveyConfig;
  existingCoupon: string | null;
}

type AnswerValue = string | string[] | undefined;
type Answers = Record<string, AnswerValue>;

export function SurveyClient({ config, existingCoupon }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  // 對 allowOther 題目，記住「其他」輸入文字
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedCoupon, setIssuedCoupon] = useState<string | null>(existingCoupon);

  // 已填過 / 剛填完 → 顯示 coupon 頁
  if (issuedCoupon) {
    return <ThankYouView coupon={issuedCoupon} survey={config} />;
  }

  function setSingle(q: Question, value: string) {
    setAnswers((a) => ({ ...a, [q.id]: value }));
  }
  function toggleMulti(q: Question, value: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [];
      return {
        ...a,
        [q.id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      };
    });
  }
  function setText(q: Question, value: string) {
    setAnswers((a) => ({ ...a, [q.id]: value }));
  }

  function buildFinalAnswers(): Answers {
    const final: Answers = { ...answers };
    // 把 otherText 合併進對應題目的 answer
    for (const q of config.questions) {
      if (!q.allowOther) continue;
      const txt = (otherText[q.id] ?? "").trim();
      if (!txt) continue;
      const tag = `other:${txt}`;
      if (q.type === "single") {
        // single 模式下 user 應該選 other 才填文字（前端用 special value "__other__"）
        if (answers[q.id] === "__other__") final[q.id] = tag;
      } else if (q.type === "multi") {
        const cur = Array.isArray(final[q.id]) ? (final[q.id] as string[]) : [];
        if (cur.includes("__other__")) {
          final[q.id] = [...cur.filter((v) => v !== "__other__"), tag];
        }
      }
    }
    return final;
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const finalAnswers = buildFinalAnswers();
      const res = await fetch(`/api/survey/${config.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setIssuedCoupon(json.couponCode ?? "已記錄");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-3">{config.title}</h1>
      <div className="text-sm text-zinc-700 mb-8 whitespace-pre-line leading-relaxed">
        {config.intro}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-8"
      >
        {config.questions.map((q, idx) => (
          <QuestionBlock
            key={q.id}
            q={q}
            idx={idx + 1}
            value={answers[q.id]}
            otherText={otherText[q.id] ?? ""}
            onSingle={(v) => setSingle(q, v)}
            onMulti={(v) => toggleMulti(q, v)}
            onText={(v) => setText(q, v)}
            onOtherText={(v) => setOtherText((s) => ({ ...s, [q.id]: v }))}
          />
        ))}

        {error && (
          <div className="p-3 rounded bg-rose-50 border border-rose-300 text-sm text-rose-900">
            ❌ {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← 回首頁
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 disabled:opacity-50"
          >
            {submitting ? "送出中…" : "送出問卷"}
          </button>
        </div>
      </form>
    </main>
  );
}

function QuestionBlock({
  q,
  idx,
  value,
  otherText,
  onSingle,
  onMulti,
  onText,
  onOtherText,
}: {
  q: Question;
  idx: number;
  value: AnswerValue;
  otherText: string;
  onSingle: (v: string) => void;
  onMulti: (v: string) => void;
  onText: (v: string) => void;
  onOtherText: (v: string) => void;
}) {
  const isOtherSelected =
    (q.type === "single" && value === "__other__") ||
    (q.type === "multi" && Array.isArray(value) && value.includes("__other__"));

  return (
    <div className="p-5 rounded-lg bg-zinc-50 border border-zinc-200">
      <div className="font-semibold text-zinc-900 mb-1">
        {idx}. {q.label}
        {q.required && <span className="text-rose-600 ml-1">*</span>}
      </div>
      {q.help && <div className="text-xs text-zinc-500 mb-3">{q.help}</div>}
      <div className="mt-3 space-y-2">
        {q.type === "single" &&
          q.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={q.id}
                checked={value === opt.value}
                onChange={() => onSingle(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        {q.type === "single" && q.allowOther && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={q.id}
              checked={value === "__other__"}
              onChange={() => onSingle("__other__")}
            />
            <span className="text-sm">其他</span>
            {isOtherSelected && (
              <input
                type="text"
                value={otherText}
                onChange={(e) => onOtherText(e.target.value)}
                placeholder="自由填寫"
                className="ml-2 px-2 py-1 text-sm border border-zinc-300 rounded flex-1"
              />
            )}
          </label>
        )}
        {q.type === "multi" &&
          q.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(opt.value)}
                onChange={() => onMulti(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        {q.type === "multi" && q.allowOther && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Array.isArray(value) && value.includes("__other__")}
              onChange={() => onMulti("__other__")}
            />
            <span className="text-sm">其他</span>
            {isOtherSelected && (
              <input
                type="text"
                value={otherText}
                onChange={(e) => onOtherText(e.target.value)}
                placeholder="自由填寫"
                className="ml-2 px-2 py-1 text-sm border border-zinc-300 rounded flex-1"
              />
            )}
          </label>
        )}
        {q.type === "text" && (
          <textarea
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-zinc-300 rounded text-sm"
            placeholder="自由回答"
          />
        )}
      </div>
    </div>
  );
}

function ThankYouView({ coupon, survey }: { coupon: string; survey: SurveyConfig }) {
  const discount = survey.couponReward?.discountPercent ?? 50;
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-center">
      <h1 className="text-3xl font-bold text-amber-800 mb-4">謝謝你 🪵</h1>
      <p className="text-zinc-700 leading-relaxed mb-8">
        我會逐則看你的回饋。<br />
        你接下來幾週用木作藍圖時遇到任何問題,直接寫信給我都行。
      </p>
      <div className="p-6 rounded-xl bg-amber-50 border-2 border-amber-300 inline-block">
        <div className="text-sm text-zinc-600 mb-2">你的專屬 {discount}% 折扣 code</div>
        <div className="text-3xl font-mono font-bold text-amber-900 mb-3 tracking-wide">
          {coupon}
        </div>
        <div className="text-xs text-zinc-500">
          結帳時輸入此 code,個人版第一個月半價
          <br />
          (此 code 7 天內有效)
        </div>
      </div>
      <div className="mt-8">
        <Link
          href="/pricing"
          className="inline-block px-6 py-3 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800"
        >
          現在去 /pricing 升級 →
        </Link>
      </div>
      <div className="mt-4">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 回首頁
        </Link>
      </div>
    </main>
  );
}
