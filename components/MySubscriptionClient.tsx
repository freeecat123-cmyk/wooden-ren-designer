"use client";

import Link from "next/link";
import { useUserPlan } from "@/hooks/useUserPlan";
import { studentDaysRemaining, PLAN_LABEL } from "@/lib/permissions";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toISOString().slice(0, 10);
}

export function MySubscriptionClient() {
  const { profile, plan, isLoading, isLoggedIn } = useUserPlan();

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
          <div>
            <h2 className="font-semibold text-zinc-900 mb-1">
              {PLAN_LABEL[profile.plan]}
            </h2>
            <p className="text-sm text-zinc-600">
              到期日：{formatDate(profile.subscription_expires_at)}
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              狀態：{profile.subscription_status}
            </p>
          </div>
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
            第 3 年起可享學員專屬價 <strong>NT$ 490 / 月</strong>
            （原價 890，學員 8 折）。
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
            可選「學員續用版 NT$ 490 / 月」延續完整功能。
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
          到期後可享學員續用價 NT$ 490 / 月（原價 890）。
        </p>
      )}
    </div>
  );
}
