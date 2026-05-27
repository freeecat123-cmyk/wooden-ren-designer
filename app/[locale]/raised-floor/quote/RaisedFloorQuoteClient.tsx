"use client";

/**
 * /raised-floor/quote — 報價單預覽 + 設定頁
 *
 * 跟 EngineeringQuoteClient 同骨架,但多三件事:
 *   1. viewMode 客戶版/內部版 切換 → 轉印列時把 ?viewMode= 帶過去
 *   2. 報價歷史用獨立 key `wooden-ren-designer:raisedFloorQuoteHistory:v1`(跟 floor 區分)
 *   3. 列印標題自動加客戶名 → PDF 檔名:`{客戶}_架高地板_{日期}`
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import { CustomerForm } from "@/components/customer/CustomerForm";
import {
  EngineeringQuoteForm,
  type EngQuoteOpts,
} from "@/components/engineering-quote/EngineeringQuoteForm";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { encodeState } from "@/lib/engineering-quote/url-codec";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { formatTWD } from "@/lib/pricing/catalog";
import type { EngLineItem } from "@/lib/engineering-quote/types";

const HISTORY_KEY = "wooden-ren-designer:raisedFloorQuoteHistory:v1";
const MAX_HISTORY = 20;

type ViewMode = "customer" | "internal";

interface QuoteHistoryEntry {
  savedAt: string;
  customerName: string;
  total: number;
  /** raised-floor 模擬器 input(d) */
  d: string;
  /** opts(o) */
  o: string;
  /** customer(c) */
  c: string;
  /** viewMode 列印偏好 */
  viewMode: ViewMode;
}

function loadHistory(): QuoteHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(entry: QuoteHistoryEntry): void {
  if (typeof window === "undefined") return;
  if (!entry.customerName.trim()) return;
  const existing = loadHistory();
  const dedup = existing.filter(
    (e) => !(e.customerName === entry.customerName && e.d === entry.d),
  );
  dedup.unshift(entry);
  window.localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(dedup.slice(0, MAX_HISTORY)),
  );
}

interface Props {
  /** 模擬器 input 的 base64(原樣傳給列印頁) */
  encodedSimInput: string;
  /** 平面圖縮圖 */
  overview: React.ReactNode;
  /** 由 server adapter 算好的基礎欄位 */
  base: {
    pingShu: number;
    areaM2: number;
    materialCost: number;
    materialLines: EngLineItem[];
  };
}

export function RaisedFloorQuoteClient({
  encodedSimInput,
  overview,
  base,
}: Props) {
  const t = useTranslations("raisedFloorQuote");
  const locale = useLocale();
  const router = useRouter();
  const customerFormRef = useRef<HTMLFormElement>(null);
  const [opts, setOpts] = useState<EngQuoteOpts>(ENGINEERING_QUOTE_DEFAULTS);
  const [viewMode, setViewMode] = useState<ViewMode>("customer");
  const [history, setHistory] = useState<QuoteHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const breakdown = useMemo(
    () =>
      computeEngineeringQuote(
        {
          quoteType: "floor",
          pingShu: base.pingShu,
          areaM2: base.areaM2,
          materialCost: base.materialCost,
          materialLines: base.materialLines,
          laborPricePerPing: opts.laborPricePerPing,
          demolitionMode: opts.demolitionMode,
          demolitionLump: opts.demolitionLump,
          demolitionPerPing: opts.demolitionPerPing,
          shippingCost: opts.shippingCost,
          consumablesMode: opts.consumablesMode,
          consumablesLump: opts.consumablesLump,
          consumablesPercent: opts.consumablesPercent,
          paintingPerPing: 0,
          marginRate: opts.marginRate,
          vatRate: opts.vatRate,
          discountRate: opts.discountRate,
          depositRate: opts.depositRate,
          validityDays: opts.validityDays,
        },
        locale,
      ),
    [base, opts, locale],
  );

  function readCustomer(): CustomerInfo {
    const formEl = customerFormRef.current;
    const fd = formEl ? new FormData(formEl) : new FormData();
    return {
      name: String(fd.get("customerName") ?? ""),
      contact: String(fd.get("customerContact") ?? ""),
      phone: String(fd.get("customerPhone") ?? ""),
      address: String(fd.get("customerAddress") ?? ""),
      taxId: String(fd.get("customerTaxId") ?? ""),
      email: String(fd.get("customerEmail") ?? ""),
    };
  }

  function buildPrintParams(customer: CustomerInfo): URLSearchParams {
    const params = new URLSearchParams();
    params.set("d", encodedSimInput);
    params.set("o", encodeState(opts));
    params.set("c", encodeState(customer));
    params.set("viewMode", viewMode);
    return params;
  }

  function goPrint() {
    const customer = readCustomer();
    const params = buildPrintParams(customer);

    // 寫入報價歷史(僅客戶名非空)
    saveHistory({
      savedAt: new Date().toISOString(),
      customerName: customer.name,
      total: breakdown.total,
      d: encodedSimInput,
      o: params.get("o") ?? "",
      c: params.get("c") ?? "",
      viewMode,
    });
    setHistory(loadHistory());

    router.push(`/raised-floor/quote/print?${params.toString()}`);
  }

  function clearHistory() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
    setHistory([]);
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-bold">{t("h1")}</h1>
        <a
          href="/raised-floor"
          className="text-xs text-zinc-500 hover:text-[#bd9955] underline"
        >
          {t("backToSim")}
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 左:輸入 */}
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("secCustomer")}</h2>
            <form
              ref={customerFormRef}
              onSubmit={(e) => e.preventDefault()}
            >
              <CustomerForm initial={EMPTY_CUSTOMER} />
            </form>
          </section>

          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("secFeeOpts")}</h2>
            <EngineeringQuoteForm
              quoteType="floor"
              value={opts}
              onChange={setOpts}
            />
          </section>

          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("secPrintMode")}</h2>
            <div className="flex gap-2 text-xs">
              <label
                className={`flex-1 cursor-pointer rounded border px-3 py-2 text-center ${
                  viewMode === "customer"
                    ? "border-[#bd9955] bg-[#bd9955]/10 font-semibold text-[#8a6d3b]"
                    : "border-zinc-300 text-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="viewMode"
                  value="customer"
                  checked={viewMode === "customer"}
                  onChange={() => setViewMode("customer")}
                  className="hidden"
                />
                {t("modeCustomer")}
              </label>
              <label
                className={`flex-1 cursor-pointer rounded border px-3 py-2 text-center ${
                  viewMode === "internal"
                    ? "border-[#bd9955] bg-[#bd9955]/10 font-semibold text-[#8a6d3b]"
                    : "border-zinc-300 text-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="viewMode"
                  value="internal"
                  checked={viewMode === "internal"}
                  onChange={() => setViewMode("internal")}
                  className="hidden"
                />
                {t("modeInternal")}
              </label>
            </div>
          </section>
        </div>

        {/* 右:試算 */}
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 p-4">
            <div className="mb-2 text-xs text-zinc-500">
              {t("summaryArea", {
                ping: base.pingShu.toFixed(2),
                m2: base.areaM2.toFixed(2),
              })}
            </div>
            {overview}
          </section>

          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("secQuote")}</h2>
            <table className="w-full text-xs">
              <tbody>
                {breakdown.lines.map((ln, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-1">{ln.label}</td>
                    <td className="py-1 text-right">
                      {ln.unpriced ? (
                        <span className="text-zinc-400">{t("unpriced")}</span>
                      ) : (
                        formatTWD(ln.amount)
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-400 font-bold">
                  <td className="py-1">{t("totalWithVat")}</td>
                  <td className="py-1 text-right">{formatTWD(breakdown.total)}</td>
                </tr>
              </tbody>
            </table>
            {breakdown.hasUnpriced && (
              <p className="mt-2 text-xs text-rose-600">
                {t("unpricedWarn")}
              </p>
            )}
            <button
              onClick={goPrint}
              className="mt-4 w-full rounded bg-[#bd9955] py-2 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              {t("printBtn")}
            </button>
          </section>

          {history.length > 0 && (
            <section className="rounded-lg border border-zinc-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {t("historyH", { n: history.length })}
                </h2>
                <button
                  onClick={clearHistory}
                  className="text-[11px] text-zinc-400 hover:text-red-600 hover:underline"
                >
                  {t("clearHistory")}
                </button>
              </div>
              <ul className="divide-y divide-zinc-100 text-xs">
                {history.map((e, i) => (
                  <li key={i} className="flex items-baseline gap-2 py-1.5">
                    <span className="font-mono text-[10px] text-zinc-400 whitespace-nowrap">
                      {e.savedAt.slice(0, 10)}
                    </span>
                    <span className="font-medium truncate">
                      {e.customerName || t("noCustomer")}
                    </span>
                    <span className="ml-auto font-mono text-zinc-700">
                      {formatTWD(e.total)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams();
                        params.set("d", e.d);
                        params.set("o", e.o);
                        params.set("c", e.c);
                        params.set("viewMode", e.viewMode);
                        window.open(
                          `/raised-floor/quote/print?${params.toString()}`,
                          "_blank",
                        );
                      }}
                      className="px-1.5 py-0.5 text-[10px] rounded border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100"
                    >
                      {t("reopen")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
