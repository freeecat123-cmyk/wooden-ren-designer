"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUserPlan } from "@/hooks/useUserPlan";
import { InvoicePreferenceCard } from "@/components/InvoicePreferenceCard";
import { studentDaysRemaining, PLAN_LABEL } from "@/lib/permissions";
import {
  GRACE_PERIOD_DAYS,
  isExpiredPastGrace,
  isExpiringSoon,
  isInGracePeriod,
} from "@/lib/pricing/expiry";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toISOString().slice(0, 10);
}

const SUB_STATUS_ZH: Record<string, string> = {
  active: "使用中",
  inactive: "未啟用",
  cancelled: "已取消",
  expired: "已到期",
};

interface PendingPayment {
  amount: number;
  paymentInfo: {
    method: "atm" | "cvs" | "barcode";
    expireDate: string;
    bankCode?: string;
    vAccount?: string;
    paymentNo?: string;
    barcode1?: string;
    barcode2?: string;
    barcode3?: string;
  } | null;
}

function PendingRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-amber-700">{label}</span>
      <span
        className={
          mono
            ? "font-mono font-semibold text-amber-900"
            : "font-semibold text-amber-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

/** 「⏳ 等待繳費」卡片 — ATM/超商/條碼取號後、使用者尚未繳費時顯示繳費資訊 */
function PendingPaymentCard() {
  const [pending, setPending] = useState<PendingPayment | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/my-pending-payment")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setPending(d.pending ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!pending?.paymentInfo) return null;
  const info = pending.paymentInfo;
  const deadline = new Date(info.expireDate).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="font-semibold text-amber-900">⏳ 等待繳費</p>
      <p className="mt-1 text-sm text-amber-800">
        應繳 NT$ {pending.amount.toLocaleString()}，請於 {deadline}{" "}
        前完成繳費，繳費後訂閱會自動啟用。
      </p>
      <div className="mt-3 space-y-1 text-sm">
        {info.method === "atm" && (
          <>
            <PendingRow label="付款方式" value="ATM 轉帳" />
            <PendingRow label="銀行代碼" value={info.bankCode ?? ""} mono />
            <PendingRow label="虛擬帳號" value={info.vAccount ?? ""} mono />
          </>
        )}
        {info.method === "cvs" && (
          <>
            <PendingRow label="付款方式" value="超商代碼繳費" />
            <PendingRow label="繳費代碼" value={info.paymentNo ?? ""} mono />
          </>
        )}
        {info.method === "barcode" && (
          <>
            <PendingRow label="付款方式" value="超商條碼繳費" />
            <PendingRow label="條碼一" value={info.barcode1 ?? ""} mono />
            <PendingRow label="條碼二" value={info.barcode2 ?? ""} mono />
            <PendingRow label="條碼三" value={info.barcode3 ?? ""} mono />
            <p className="pt-1 text-xs text-amber-700">
              請至超商出示三段條碼繳費。
            </p>
          </>
        )}
      </div>
    </div>
  );
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

      <PendingPaymentCard />

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

      {/* 永久買斷清單(範本 + 工具)——沒買過完全不顯示 */}
      <UnlocksSection />

      {/* 發票偏好設定（只有付費方案才顯示） */}
      {!isStudent &&
        profile &&
        (profile.plan === "personal" || profile.plan === "pro" || profile.plan === "lifetime") && (
          <InvoicePreferenceCard />
        )}
    </main>
  );
}

interface UnlockedTemplate { category: string; created_at: string; }
interface UnlockedTool { tool: string; created_at: string; }

function UnlocksSection() {
  const [templates, setTemplates] = useState<UnlockedTemplate[]>([]);
  const [tools, setTools] = useState<UnlockedTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        const [tplRes, toolRes] = await Promise.all([
          supabase
            .from("template_unlocks")
            .select("category, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("tool_unlocks")
            .select("tool, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;
        setTemplates((tplRes.data ?? []) as UnlockedTemplate[]);
        setTools((toolRes.data ?? []) as UnlockedTool[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (templates.length === 0 && tools.length === 0) return null;

  const TEMPLATE_NAME: Record<string, string> = {
    stool: "方凳", bench: "長凳", "tea-table": "茶几", "side-table": "邊桌",
    "low-table": "矮桌", "open-bookshelf": "開放書櫃", "chest-of-drawers": "斗櫃",
    "shoe-cabinet": "鞋櫃", "display-cabinet": "玻璃展示櫃", "dining-table": "餐桌",
    desk: "書桌", "dining-chair": "餐椅", wardrobe: "衣櫃", "bar-stool": "吧檯椅",
    "media-console": "電視櫃", nightstand: "床頭櫃", "round-stool": "圓凳",
    "round-tea-table": "圓茶几", "round-table": "圓餐桌", "pencil-holder": "筆筒",
    bookend: "書擋", "photo-frame": "相框", tray: "托盤", "dovetail-box": "木盒",
    "wine-rack": "紅酒架",
  };
  const TOOL_NAME: Record<string, string> = {
    ceiling: "🔨 天花板骨架施工模擬器",
    floor: "🪵 地板施工模擬器",
  };

  return (
    <div className="mt-6 rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5 sm:p-6">
      <h2 className="font-semibold text-zinc-900 mb-3 flex items-center gap-2">
        🎫 永久買斷清單
      </h2>
      <p className="text-xs text-zinc-600 mb-4">這些是你一次買斷的內容,永久使用,不會跟訂閱一起到期。</p>

      {tools.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-zinc-700 mb-2">裝潢工具</div>
          <ul className="space-y-1">
            {tools.map((t) => (
              <li key={t.tool} className="flex items-center justify-between text-sm">
                <span>{TOOL_NAME[t.tool] ?? t.tool}</span>
                <Link href={t.tool === "ceiling" ? "/ceiling" : "/floor"} className="text-xs text-amber-700 hover:underline">
                  開啟 →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {templates.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-zinc-700 mb-2">家具範本</div>
          <ul className="space-y-1">
            {templates.map((t) => (
              <li key={t.category} className="flex items-center justify-between text-sm">
                <span>🪵 {TEMPLATE_NAME[t.category] ?? t.category}</span>
                <Link href={`/design/${t.category}`} className="text-xs text-amber-700 hover:underline">
                  開啟 →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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

  const expiringSoon = isExpiringSoon(expiresAt, 7);
  const inGrace = isInGracePeriod(expiresAt);
  const pastGrace = isExpiredPastGrace(expiresAt);
  // grace 內剩餘天數
  const expiresAtTime = expiresAt ? new Date(expiresAt).getTime() : null;
  const graceEndTime = expiresAtTime
    ? expiresAtTime + GRACE_PERIOD_DAYS * 86_400_000
    : null;
  const graceDaysLeft = graceEndTime
    ? Math.max(0, Math.ceil((graceEndTime - Date.now()) / 86_400_000))
    : null;
  const daysUntilExpiry = expiresAtTime
    ? Math.max(0, Math.ceil((expiresAtTime - Date.now()) / 86_400_000))
    : null;

  return (
    <div>
      <h2 className="font-semibold text-zinc-900 mb-1">{planLabel}</h2>
      <p className="text-sm text-zinc-600">
        到期日：{formatDate(expiresAt)}
      </p>
      <p className="text-sm text-zinc-500 mt-1">
        狀態:{isCancelled ? "已取消(到期前仍可用)" : (SUB_STATUS_ZH[status] ?? status)}
      </p>

      {/* 7 天內到期黃色 reminder（未取消才顯示） */}
      {expiringSoon && !isCancelled && (
        <div
          className="mt-4 rounded-lg p-3 border"
          style={{ background: "#fefce8", borderColor: "#facc15" }}
        >
          <p className="text-xs text-[#854d0e] leading-relaxed">
            ⏰ 還剩 {daysUntilExpiry} 天到期。月扣方案會自動續扣，無需操作；如果是
            年付或想換方案，可以
            <Link href="/pricing" className="underline ml-1">重新訂閱</Link>。
          </p>
        </div>
      )}

      {/* grace period 紅色急切 reminder */}
      {inGrace && (
        <div
          className="mt-4 rounded-lg p-3 border-2"
          style={{ background: "#fef2f2", borderColor: "#f87171" }}
        >
          <p className="text-sm text-[#991b1b] leading-relaxed font-medium">
            ⚠️ 訂閱已到期 — 寬限期剩 {graceDaysLeft} 天
          </p>
          <p className="text-xs text-[#991b1b] mt-1 leading-relaxed">
            付費功能仍可使用，請於 {graceDaysLeft} 天內續訂、否則自動降回免費版。
            常見原因：信用卡到期、額度不足、銀行驗證失敗。
            <Link href="/pricing" className="underline ml-1 font-semibold">立即續訂 →</Link>
          </p>
        </div>
      )}

      {/* 已過 grace、應已被 cron 降為 free — 出現代表 cron 還沒跑、或 cron 失敗 */}
      {pastGrace && (
        <div
          className="mt-4 rounded-lg p-3 border-2"
          style={{ background: "#f3f4f6", borderColor: "#9ca3af" }}
        >
          <p className="text-sm text-zinc-700 leading-relaxed">
            訂閱已到期超過 {GRACE_PERIOD_DAYS} 天寬限期，系統會在下次掃描時自動
            降為免費版。要恢復付費功能可至
            <Link href="/pricing" className="underline ml-1 font-medium">/pricing</Link>
            重新訂閱。
          </p>
        </div>
      )}

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
            想恢復可隨時到 <Link href="/pricing" className="underline">方案頁</Link>重新訂閱。
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
