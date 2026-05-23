"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RefundRequest {
  id: string;
  amount_requested: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "審核中",
  approved: "已通過",
  rejected: "未通過",
  refunded: "已退款",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-50 text-amber-900 border-amber-300",
  approved: "bg-emerald-50 text-emerald-900 border-emerald-300",
  rejected: "bg-rose-50 text-rose-900 border-rose-300",
  refunded: "bg-sky-50 text-sky-900 border-sky-300",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export function RefundClient() {
  const [requests, setRequests] = useState<RefundRequest[] | null>(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  async function loadRequests() {
    try {
      const res = await fetch("/api/refund", { cache: "no-store" });
      if (res.status === 401) {
        setNotLoggedIn(true);
        return;
      }
      const j = await res.json();
      setRequests((j.data ?? []) as RefundRequest[]);
    } catch (e) {
      console.warn("[refund] load failed", e);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  return (
    <>
      <section className="mt-12 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-6">
        <h2 className="text-lg font-semibold mb-3">如何申請退費</h2>
        <p className="text-sm text-zinc-700 leading-relaxed mb-3">
          木作藍圖為數位虛擬商品，依「3. 不予退費之情形」原則上不接受退費。
          若您有特殊情況需申請退費，請<strong>直接 email</strong> 給木頭仁本人，
          會逐則人工評估後 email 回覆。
        </p>
        <div className="mt-4 rounded-lg bg-white border border-amber-300 p-4">
          <p className="text-sm text-zinc-700 mb-1">退費聯絡信箱：</p>
          <a
            className="text-base font-mono font-semibold text-amber-800 hover:underline"
            href="mailto:wengbinren@gmail.com?subject=木作藍圖退費申請"
          >
            wengbinren@gmail.com
          </a>
          <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
            來信請註明：註冊 email、訂單編號（在我的訂閱頁可查）、付款日期、申請原因。
            <br />
            一般在 7 個工作日內回覆。
          </p>
        </div>
        {notLoggedIn && (
          <p className="text-xs text-zinc-500 mt-3">
            <Link href="/login?next=/refund" className="underline text-emerald-700">登入</Link>
            後可在下方查看自己的退費紀錄。
          </p>
        )}
      </section>

      {requests !== null && requests.length > 0 && (
        <section className="mt-8 rounded-xl border-2 border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-3">我的退費紀錄</h2>
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="border border-zinc-200 rounded-lg p-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="text-sm">
                    <span className="font-semibold">NT$ {r.amount_requested.toLocaleString()}</span>
                    <span className="text-zinc-500 ml-2 text-xs">申請日 {fmtDate(r.created_at)}</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border font-medium ${
                      STATUS_COLOR[r.status] ?? ""
                    }`}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-1 whitespace-pre-wrap">{r.reason}</p>
                {r.admin_note && (
                  <div className="mt-2 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded p-2">
                    <strong>客服回覆：</strong>{r.admin_note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
