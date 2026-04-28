"use client";

import { useEffect, useState } from "react";

// Early-bird window: 2026-04-27 00:00 ~ 2026-05-10 23:59:59 (+08:00)
const DEADLINE_MS = new Date("2026-05-10T23:59:59+08:00").getTime();
const TOTAL_SLOTS = 100;

// Update this manually as payments come in (replace with /api/early-bird later)
const CLAIMED = 0;

function formatRemaining(ms: number) {
  if (ms <= 0) return null;
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  return { days, hours, mins, secs };
}

export function EarlyBirdBanner() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now === null) return null;
  const remaining = formatRemaining(DEADLINE_MS - now);
  if (!remaining) return null;

  const slotsLeft = Math.max(0, TOTAL_SLOTS - CLAIMED);
  const pct = Math.min(100, Math.round((CLAIMED / TOTAL_SLOTS) * 100));

  return (
    <div
      className="max-w-3xl mx-auto mb-8 px-5 py-4 rounded-2xl border-2 shadow-sm"
      style={{
        background: "linear-gradient(135deg, #fff8ee 0%, #ffeacc 100%)",
        borderColor: "#d4a574",
      }}
    >
      <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
        <span className="text-2xl flex-shrink-0">🔥</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#5a3812] text-base sm:text-lg">
            上線早鳥優惠 · 前 {TOTAL_SLOTS} 名專業月付半價
          </p>
          <p className="mt-1 text-sm text-[#7c4f1a]">
            首 3 個月 NT$445/月（原價 NT$890），第 4 個月起恢復原價，可隨時取消
          </p>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm font-mono">
              <CountBox n={remaining.days} label="天" />
              <CountBox n={remaining.hours} label="時" />
              <CountBox n={remaining.mins} label="分" />
              <CountBox n={remaining.secs} label="秒" />
            </div>
            <div className="flex items-center gap-2 text-xs text-[#7c4f1a]">
              <span className="font-semibold">剩 {slotsLeft} / {TOTAL_SLOTS} 名</span>
              <div className="w-24 h-2 rounded-full bg-white/70 overflow-hidden">
                <div
                  className="h-full bg-[#c0651e] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CountBox({ n, label }: { n: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="px-2 py-1 rounded-md bg-[#5a3812] text-white text-sm font-bold tabular-nums min-w-[2ch] text-center">
        {String(n).padStart(2, "0")}
      </span>
      <span className="text-xs text-[#7c4f1a] mr-1">{label}</span>
    </span>
  );
}

export const EARLY_BIRD = {
  DEADLINE_MS,
  TOTAL_SLOTS,
  CLAIMED,
  isActive: () => Date.now() < DEADLINE_MS && CLAIMED < TOTAL_SLOTS,
};
