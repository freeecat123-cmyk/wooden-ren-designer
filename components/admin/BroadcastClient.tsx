"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SURVEYS } from "@/lib/survey/configs";

type AudienceKind = "all" | "unpaid" | "paid" | "plan" | "manual";
type PlanId = "free" | "personal" | "pro" | "student" | "lifetime";

interface UserRow {
  email: string;
  plan: string;
  subscription_status: string | null;
  subscription_expires_at?: string | null;
  student_expires_at?: string | null;
}

// 跟 lib/permissions.ts 同邏輯，重寫在 client 側做即時 audience 預覽計數
function getEffectivePlan(r: UserRow): PlanId {
  if (r.plan === "student") {
    if (r.student_expires_at && new Date(r.student_expires_at) > new Date()) {
      return "student";
    }
    return "free";
  }
  if (r.plan === "lifetime") return "lifetime";
  if (
    r.subscription_status === "active" &&
    r.subscription_expires_at &&
    new Date(r.subscription_expires_at) > new Date()
  ) {
    return r.plan as PlanId;
  }
  return "free";
}

export function BroadcastClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [audienceKind, setAudienceKind] = useState<AudienceKind>("unpaid");
  const [audiencePlan, setAudiencePlan] = useState<PlanId>("personal");
  const [manualEmails, setManualEmails] = useState("");

  // 排除已填問卷者（重寄場景）— 空字串 = 不排除
  const surveyKeys = useMemo(() => Object.keys(SURVEYS), []);
  const [excludeSurveyId, setExcludeSurveyId] = useState<string>("");
  const [excludedEmails, setExcludedEmails] = useState<Set<string>>(new Set());
  const [loadingExclude, setLoadingExclude] = useState(false);

  // 選了問卷 → fetch 該問卷的填寫者 email（小寫 set，比對用）
  useEffect(() => {
    if (!excludeSurveyId) {
      setExcludedEmails(new Set());
      return;
    }
    setLoadingExclude(true);
    fetch(`/api/admin/survey-respondents?survey_id=${encodeURIComponent(excludeSurveyId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.emails)) {
          setExcludedEmails(new Set(j.emails.map((e: string) => e.toLowerCase())));
        }
      })
      .finally(() => setLoadingExclude(false));
  }, [excludeSurveyId]);

  const [subject, setSubject] = useState("");
  const [textBody, setTextBody] = useState("");
  const [htmlBody, setHtmlBody] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/users");
        const json = await res.json();
        if (Array.isArray(json.data)) setUsers(json.data);
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  // 即時算 audience 命中數（含「排除已填問卷者」扣除）
  const audienceCount = useMemo(() => {
    const notExcluded = (email: string) =>
      excludedEmails.size === 0 || !excludedEmails.has(email.trim().toLowerCase());
    if (audienceKind === "manual") {
      return manualEmails
        .split(/\n|,/)
        .map((e) => e.trim())
        .filter((e) => e.includes("@"))
        .filter(notExcluded)
        .length;
    }
    return users.filter((u) => {
      const eff = getEffectivePlan(u);
      const kindMatch =
        audienceKind === "all" ? true
        : audienceKind === "unpaid" ? eff === "free"
        : audienceKind === "paid" ? eff !== "free"
        : audienceKind === "plan" ? eff === audiencePlan
        : false;
      return kindMatch && notExcluded(u.email);
    }).length;
  }, [users, audienceKind, audiencePlan, manualEmails, excludedEmails]);

  const breakdown = useMemo(() => {
    const counts = { free: 0, personal: 0, pro: 0, student: 0, lifetime: 0 } as Record<string, number>;
    for (const u of users) counts[getEffectivePlan(u)]++;
    return counts;
  }, [users]);

  async function buildPayload(dryRun: boolean) {
    const filter: {
      kind: AudienceKind;
      plan?: PlanId;
      emails?: string[];
      excludeRespondentsOfSurveyId?: string;
    } = { kind: audienceKind };
    if (audienceKind === "plan") filter.plan = audiencePlan;
    if (audienceKind === "manual") {
      filter.emails = manualEmails.split(/\n|,/).map((e) => e.trim()).filter((e) => e.includes("@"));
    }
    if (excludeSurveyId) filter.excludeRespondentsOfSurveyId = excludeSurveyId;
    return {
      audience: filter,
      subject,
      text: textBody,
      html: htmlBody,
      dryRun,
    };
  }

  async function sendDryRun() {
    setError(null);
    setResult(null);
    setSending(true);
    try {
      const payload = await buildPayload(true);
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setResult(`✅ 預覽信寄到 ${json.sentTo}，去你信箱看`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function sendBatch() {
    setError(null);
    setResult(null);
    setSending(true);
    setConfirmOpen(false);
    try {
      const payload = await buildPayload(false);
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setResult(
          `✅ 寄送完成：${json.sent}/${json.recipientCount} 成功${json.failed > 0 ? ` · ❌ ${json.failed} 失敗（看 email_queue）` : ""}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  const canSend = subject.trim() && textBody.trim() && htmlBody.trim() && audienceCount > 0 && !sending;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-sm text-zinc-500 hover:underline">← 後台</Link>
          <h1 className="text-2xl font-bold mt-1">📧 批次寄信</h1>
          <p className="text-sm text-zinc-600 mt-1">
            按 audience 篩選用戶批次寄 email。500ms throttle 配 Resend free tier 2/sec。
          </p>
        </div>
      </header>

      {/* 用戶分佈快覽 */}
      <section className="mb-6 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
        <h2 className="text-sm font-semibold text-zinc-700 mb-2">用戶分佈</h2>
        {loadingUsers ? (
          <p className="text-sm text-zinc-500">載入中…</p>
        ) : (
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-white border">總計 {users.length}</span>
            <span className="px-2 py-1 rounded bg-zinc-100 border border-zinc-300">免費 {breakdown.free}</span>
            <span className="px-2 py-1 rounded bg-sky-100 border border-sky-300">個人 {breakdown.personal}</span>
            <span className="px-2 py-1 rounded bg-purple-100 border border-purple-300">專業 {breakdown.pro}</span>
            <span className="px-2 py-1 rounded bg-amber-100 border border-amber-300">學員 {breakdown.student}</span>
            <span className="px-2 py-1 rounded bg-rose-100 border border-rose-300">終身 {breakdown.lifetime}</span>
          </div>
        )}
      </section>

      {/* Audience filter */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-2">寄送對象</h2>
        <div className="space-y-2">
          {(
            [
              { key: "all", label: "全部用戶" },
              { key: "unpaid", label: "未付費（effective=free）" },
              { key: "paid", label: "已付費（effective≠free）" },
              { key: "plan", label: "指定方案" },
              { key: "manual", label: "手動輸入 email" },
            ] as Array<{ key: AudienceKind; label: string }>
          ).map((opt) => (
            <label key={opt.key} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="audience"
                checked={audienceKind === opt.key}
                onChange={() => setAudienceKind(opt.key)}
              />
              <span>{opt.label}</span>
              {audienceKind === opt.key && opt.key !== "manual" && (
                <span className="text-xs text-amber-700 font-mono">→ {audienceCount} 人</span>
              )}
            </label>
          ))}
        </div>
        {audienceKind === "plan" && (
          <select
            value={audiencePlan}
            onChange={(e) => setAudiencePlan(e.target.value as PlanId)}
            className="mt-2 px-3 py-1.5 rounded border border-zinc-300 text-sm"
          >
            <option value="personal">個人版</option>
            <option value="pro">專業版</option>
            <option value="student">學員版</option>
            <option value="lifetime">終身版</option>
          </select>
        )}
        {audienceKind === "manual" && (
          <textarea
            value={manualEmails}
            onChange={(e) => setManualEmails(e.target.value)}
            placeholder="一行一個 email，或用逗號分隔"
            rows={4}
            className="mt-2 w-full px-3 py-2 rounded border border-zinc-300 text-sm font-mono"
          />
        )}
        {/* 排除已填問卷者（重寄場景） */}
        <div className="mt-4 pt-3 border-t border-zinc-200">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!excludeSurveyId}
              onChange={(e) => setExcludeSurveyId(e.target.checked ? (surveyKeys[0] ?? "") : "")}
              disabled={surveyKeys.length === 0}
            />
            <span>排除已填寫此問卷者（重寄常用）</span>
            {loadingExclude && <span className="text-xs text-zinc-400">載入中…</span>}
            {!loadingExclude && excludeSurveyId && (
              <span className="text-xs text-emerald-700 font-mono">
                已填 {excludedEmails.size} 人，將排除
              </span>
            )}
          </label>
          {excludeSurveyId && (
            <select
              value={excludeSurveyId}
              onChange={(e) => setExcludeSurveyId(e.target.value)}
              className="mt-2 px-3 py-1.5 rounded border border-zinc-300 text-sm"
            >
              {surveyKeys.map((id) => (
                <option key={id} value={id}>
                  {id} ({SURVEYS[id].title ?? id})
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          目前命中：<strong className="text-amber-700 font-mono">{audienceCount} 人</strong>
          {excludeSurveyId && excludedEmails.size > 0 && (
            <span className="ml-1 text-zinc-400">（已扣除已填問卷者）</span>
          )}
        </p>
      </section>

      {/* 內容 */}
      <section className="mb-6 space-y-3">
        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-1">主旨</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 rounded border border-zinc-300 text-sm"
            placeholder="例：你註冊木作藍圖了——花 2 分鐘幫我改得更好用，送你半價 coupon"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-1">
            純文字內文（支援 <code className="bg-zinc-100 px-1">{"{{email}}"}</code> <code className="bg-zinc-100 px-1">{"{{name}}"}</code> 變數）
          </label>
          <textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded border border-zinc-300 text-sm"
            placeholder="{{name}} 你好,&#10;&#10;謝謝你註冊木作藍圖,你是我的前 44 位使用者..."
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-1">HTML 內文</label>
          <textarea
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded border border-zinc-300 text-sm font-mono"
            placeholder="<p>{{name}} 你好,</p><p>謝謝你註冊...</p>"
          />
          <p className="text-xs text-zinc-500 mt-1">
            簡單 HTML：&lt;p&gt;段落&lt;/p&gt;、&lt;a href=&quot;...&quot;&gt;連結&lt;/a&gt;、&lt;strong&gt;粗體&lt;/strong&gt;
          </p>
        </div>
      </section>

      {/* 結果 / 錯誤 */}
      {result && <div className="mb-4 p-3 rounded bg-emerald-50 border border-emerald-300 text-sm text-emerald-900">{result}</div>}
      {error && <div className="mb-4 p-3 rounded bg-rose-50 border border-rose-300 text-sm text-rose-900">❌ {error}</div>}

      {/* 操作按鈕 */}
      <section className="flex gap-3 items-center">
        <button
          type="button"
          onClick={sendDryRun}
          disabled={!canSend}
          className="px-4 py-2 rounded bg-zinc-700 text-white text-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? "處理中…" : "📤 先寄給我自己測試"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={!canSend}
          className="px-4 py-2 rounded bg-amber-700 text-white text-sm hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          🚀 批次寄送 ({audienceCount} 人)
        </button>
      </section>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-2">⚠️ 確認批次寄送</h3>
            <p className="text-sm text-zinc-700 mb-4">
              即將寄信給 <strong className="text-amber-700">{audienceCount} 人</strong>。
              <br />
              估算時間 <strong>{Math.ceil(audienceCount * 0.5)} 秒</strong>（500ms throttle）。
              <br />
              <span className="text-rose-700">送出後無法取消</span>，確認嗎？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded border border-zinc-300 text-sm hover:bg-zinc-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={sendBatch}
                className="px-4 py-2 rounded bg-amber-700 text-white text-sm hover:bg-amber-800"
              >
                確定寄送
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
