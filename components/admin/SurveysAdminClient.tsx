"use client";

import { useState } from "react";
import Link from "next/link";
import type { SurveyConfig } from "@/lib/survey/configs";

interface SurveyData {
  config: SurveyConfig;
  responseCount: number;
  responses: Array<{
    userId: string;
    email: string;
    answers: Record<string, unknown>;
    createdAt: string;
    couponCode: string | null;
  }>;
  coupons: { issued: number; used: number };
}

export function SurveysAdminClient({ surveys }: { surveys: SurveyData[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">← 後台</Link>
        <h1 className="text-2xl font-bold mt-1">📋 問卷分析</h1>
        <p className="text-sm text-zinc-600 mt-1">所有 surveys 與作答結果統計</p>
      </header>

      <div className="space-y-6">
        {surveys.map((s) => (
          <SurveyPanel
            key={s.config.id}
            data={s}
            open={openId === s.config.id}
            onToggle={() => setOpenId(openId === s.config.id ? null : s.config.id)}
          />
        ))}
      </div>
    </main>
  );
}

function SurveyPanel({
  data,
  open,
  onToggle,
}: {
  data: SurveyData;
  open: boolean;
  onToggle: () => void;
}) {
  const { config, responseCount, responses, coupons } = data;

  // 計算選項統計（single/multi）
  const stats: Record<string, Record<string, number>> = {};
  for (const q of config.questions) {
    if (q.type === "text") continue;
    stats[q.id] = {};
    for (const opt of q.options ?? []) stats[q.id][opt.value] = 0;
    stats[q.id]["__other__"] = 0;
  }
  for (const r of responses) {
    for (const q of config.questions) {
      if (q.type === "text") continue;
      const a = r.answers[q.id];
      if (q.type === "single" && typeof a === "string") {
        const key = a.startsWith("other:") ? "__other__" : a;
        if (stats[q.id][key] !== undefined) stats[q.id][key]++;
      }
      if (q.type === "multi" && Array.isArray(a)) {
        for (const v of a as string[]) {
          const key = v.startsWith("other:") ? "__other__" : v;
          if (stats[q.id][key] !== undefined) stats[q.id][key]++;
        }
      }
    }
  }

  const textAnswers = config.questions
    .filter((q) => q.type === "text")
    .map((q) => ({
      q,
      answers: responses
        .map((r) => ({ text: r.answers[q.id], email: r.email }))
        .filter((x) => typeof x.text === "string" && (x.text as string).trim()),
    }));

  return (
    <section className="border border-zinc-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50"
      >
        <div className="text-left">
          <div className="font-semibold text-zinc-900">{config.title}</div>
          <div className="text-xs text-zinc-500 mt-0.5">id: {config.id}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-2 py-1 rounded bg-sky-100 text-sky-900 border border-sky-300">
            {responseCount} 人填了
          </span>
          <span className="px-2 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300">
            coupon {coupons.used}/{coupons.issued} 用
          </span>
          <span className="text-zinc-400">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 py-4 border-t border-zinc-200 space-y-6">
          {responseCount === 0 ? (
            <p className="text-sm text-zinc-500">還沒有人填這個問卷。</p>
          ) : (
            <>
              {/* 選項題統計 */}
              {config.questions
                .filter((q) => q.type !== "text")
                .map((q) => (
                  <div key={q.id}>
                    <div className="text-sm font-semibold text-zinc-800 mb-2">{q.label}</div>
                    <div className="space-y-1">
                      {(q.options ?? []).map((opt) => {
                        const count = stats[q.id]?.[opt.value] ?? 0;
                        const pct = responseCount > 0 ? Math.round((count / responseCount) * 100) : 0;
                        return (
                          <div key={opt.value} className="flex items-center gap-2 text-xs">
                            <div className="w-48 text-zinc-700 truncate">{opt.label}</div>
                            <div className="flex-1 bg-zinc-100 rounded h-4 relative">
                              <div
                                className="absolute inset-y-0 left-0 bg-amber-500 rounded"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="w-16 text-right text-zinc-600 font-mono">
                              {count} ({pct}%)
                            </div>
                          </div>
                        );
                      })}
                      {q.allowOther && (stats[q.id]?.["__other__"] ?? 0) > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-48 text-zinc-500 truncate italic">其他</div>
                          <div className="flex-1" />
                          <div className="w-16 text-right text-zinc-600 font-mono">
                            {stats[q.id]?.["__other__"] ?? 0}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

              {/* 「其他」自由文字 */}
              {config.questions
                .filter((q) => q.allowOther)
                .map((q) => {
                  const otherTexts = responses
                    .map((r) => {
                      const a = r.answers[q.id];
                      if (q.type === "single" && typeof a === "string" && a.startsWith("other:")) {
                        return { text: a.slice(6), email: r.email };
                      }
                      if (q.type === "multi" && Array.isArray(a)) {
                        const o = (a as string[]).find((v) => v.startsWith("other:"));
                        return o ? { text: o.slice(6), email: r.email } : null;
                      }
                      return null;
                    })
                    .filter((x): x is { text: string; email: string } => !!x);
                  if (otherTexts.length === 0) return null;
                  return (
                    <div key={`${q.id}-other`}>
                      <div className="text-sm font-semibold text-zinc-800 mb-1">
                        「{q.label}」其他自由填寫
                      </div>
                      <ul className="text-xs space-y-1">
                        {otherTexts.map((x, i) => (
                          <li key={i} className="px-2 py-1 bg-zinc-50 rounded border border-zinc-200">
                            <span className="text-zinc-400 mr-2">{x.email}</span>
                            {x.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}

              {/* text 題作答 */}
              {textAnswers.map(({ q, answers }) => (
                <div key={q.id}>
                  <div className="text-sm font-semibold text-zinc-800 mb-2">
                    {q.label}
                    <span className="text-xs text-zinc-500 ml-2 font-normal">{answers.length} 則回應</span>
                  </div>
                  {answers.length === 0 ? (
                    <p className="text-xs text-zinc-400">無回應</p>
                  ) : (
                    <ul className="space-y-2">
                      {answers.map((x, i) => (
                        <li key={i} className="p-3 rounded bg-amber-50 border border-amber-200">
                          <div className="text-xs text-zinc-500 mb-1">{x.email}</div>
                          <div className="text-sm text-zinc-800 whitespace-pre-line">
                            {x.text as string}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
