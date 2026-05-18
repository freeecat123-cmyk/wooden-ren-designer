"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUserPlan } from "@/hooks/useUserPlan";
import { studentDaysRemaining, PLAN_LABEL } from "@/lib/permissions";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toISOString().slice(0, 10);
}

export function MySubscriptionClient() {
  const { profile, plan, isLoading, isLoggedIn } = useUserPlan();
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("paid") === "1") {
      setJustPaid(true);
      // 拿掉 query 避免重整再顯示一次
      const url = new URL(window.location.href);
      url.searchParams.delete("paid");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  if (isLoading) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-sm text-zinc-500">
        載入中…
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">我的訂閱</h1>
        <p className="text-zinc-600 text-sm">
          請先登入才能看訂閱狀態（右上角點「使用 Google 登入」）。
        </p>
      </main>
    );
  }

  const isStudent = profile?.plan === "student";
  const daysLeft = studentDaysRemaining(profile);
  const expired = daysLeft !== null && daysLeft <= 0;
  const expiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 回家具列表
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-3 mb-2">
        我的訂閱
      </h1>

      {justPaid && (
        <div
          className="mb-4 rounded-lg p-4 border-2"
          style={{ background: "#ecfdf5", borderColor: "#34d399" }}
        >
          <div className="font-semibold text-emerald-800 flex items-center gap-2">
            ✅ 付款成功
          </div>
          <p className="text-sm text-emerald-700 mt-1 leading-relaxed">
            綠界已收到款項，方案已生效。若以 ATM / 超商繳款，可能延遲幾分鐘才會升級——請重新整理或稍後再看。
          </p>
        </div>
      )}
      <p className="text-sm text-zinc-500 mb-6">
        目前生效的方案：
        <strong className="text-zinc-900 ml-1">{PLAN_LABEL[plan]}</strong>
      </p>

      <div className="rounded-2xl border-2 border-zinc-200 bg-white p-5 sm:p-6">
        {isStudent && (
          <StudentSection
            activatedAt={profile?.student_activated_at ?? null}
            expiresAt={profile?.student_expires_at ?? null}
            daysLeft={daysLeft}
            expired={expired}
            expiringSoon={expiringSoon}
          />
        )}

        {!isStudent && profile?.plan === "lifetime" && (
          <div>
            <h2 className="font-semibold text-zinc-900 mb-1">終身版</h2>
            <p className="text-sm text-zinc-600">
              你已購買終身版，所有付費功能永久可用。
            </p>
          </div>
        )}

        {!isStudent && (profile?.plan === "personal" || profile?.plan === "pro") && (
          <PaidPlanSection
            planLabel={PLAN_LABEL[profile.plan]}
            expiresAt={profile.subscription_expires_at}
            status={profile.subscription_status}
          />
        )}

        {!profile || profile.plan === "free" ? (
          <div>
            <h2 className="font-semibold text-zinc-900 mb-1">免費版</h2>
            <p className="text-sm text-zinc-600">
              還沒訂閱付費方案。
              <Link href="/pricing" className="text-emerald-700 hover:underline ml-1">
                看方案 →
              </Link>
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function PaidPlanSection({
  planLabel,
  expiresAt,
  status,
}: {
  planLabel: string;
  expiresAt: string | null;
  status: string;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = status === "active";
  const isCancelled = status === "cancelled" || cancelled;

  async function handleCancel() {
    if (cancelling) return;
    const ok = window.confirm(
      "取消後將停止下個月自動扣款。\n目前到期日內方案仍可正常使用，到期後自動降為免費版。\n\n確定要取消訂閱嗎？",
    );
    if (!ok) return;
    setCancelling(true);
    setError(null);
    try {
      const r = await fetch("/api/cancel-subscription", { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      setCancelled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取消失敗，請稍後再試");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div>
      <h2 className="font-semibold text-zinc-900 mb-1">{planLabel}</h2>
      <p className="text-sm text-zinc-600">
        到期日：{formatDate(expiresAt)}
      </p>
      <p className="text-sm text-zinc-500 mt-1">
        狀態：{isCancelled ? "已取消（到期前仍可用）" : status === "active" ? "生效中（每月自動續扣）" : status}
      </p>

      {isActive && !isCancelled && (
        <div className="mt-5 pt-4 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs text-zinc-500 hover:text-red-600 underline underline-offset-2 disabled:opacity-50 disabled:cursor-wait"
          >
            {cancelling ? "取消中…" : "取消訂閱（停止下個月自動扣款）"}
          </button>
          {error && (
            <p className="mt-2 text-xs text-red-600">⚠️ {error}</p>
          )}
        </div>
      )}

      {isCancelled && (
        <div
          className="mt-4 rounded-lg p-3 border"
          style={{ background: "#fff8ee", borderColor: "#d4a574" }}
        >
          <p className="text-xs text-[#7c4f1a] leading-relaxed">
            已停止自動扣款。{formatDate(expiresAt)} 之前仍可使用，之後自動降為免費版。
            想恢復可隨時到 <Link href="/pricing" className="underline">/pricing</Link> 重新訂閱。
          </p>
        </div>
      )}
    </div>
  );
}

function StudentSection({
  activatedAt,
  expiresAt,
  daysLeft,
  expired,
  expiringSoon,
}: {
  activatedAt: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  expired: boolean;
  expiringSoon: boolean;
}) {
  return (
    <div>
      <h2 className="font-semibold text-zinc-900 text-lg mb-3">
        木匠學院 學員專屬版
      </h2>
      <dl className="grid grid-cols-2 gap-y-3 text-sm">
        <dt className="text-zinc-500">開通日</dt>
        <dd className="text-zinc-900 font-medium">{formatDate(activatedAt)}</dd>
        <dt className="text-zinc-500">到期日</dt>
        <dd className="text-zinc-900 font-medium">
          {formatDate(expiresAt)}
          {daysLeft !== null && (
            <span
              className={`ml-2 text-xs ${
                expired
                  ? "text-red-600"
                  : expiringSoon
                  ? "text-amber-700 font-semibold"
                  : "text-zinc-500"
              }`}
            >
              {expired ? "（已過期）" : `（還剩 ${daysLeft} 天）`}
            </span>
          )}
        </dd>
      </dl>

      {expiringSoon && (
        <div
          className="mt-4 rounded-lg p-4 border-2"
          style={{ background: "#FFF8E7", borderColor: "#d4a574" }}
        >
          <div className="font-semibold text-[#5C3317] flex items-center gap-2">
            ⚠️ 還剩 {daysLeft} 天到期
          </div>
          <p className="text-sm text-[#7c4f1a] mt-1 leading-relaxed">
            第 3 年起可享學員專屬價（DIY 自家用 NT$ 219、接案/工作室 NT$ 690 / 月）。
          </p>
          <Link
            href="/pricing"
            className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f]"
          >
            續訂學員續用版
          </Link>
        </div>
      )}

      {expired && (
        <div
          className="mt-4 rounded-lg p-4 border-2"
          style={{ background: "#fff1f1", borderColor: "#fca5a5" }}
        >
          <div className="font-semibold text-red-700">已過期</div>
          <p className="text-sm text-red-600 mt-1 leading-relaxed">
            學員專屬版 2 年免費期已結束，已自動降為免費版。
            可選學員續用版（個人 NT$ 219 / 專業 NT$ 690 / 月）延續使用。
          </p>
          <Link
            href="/pricing"
            className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f]"
          >
            看續用方案
          </Link>
        </div>
      )}

      {!expiringSoon && !expired && (
        <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
          到期後可享學員續用價：個人 NT$ 219、專業 NT$ 690 / 月。
        </p>
      )}
    </div>
  );
}
