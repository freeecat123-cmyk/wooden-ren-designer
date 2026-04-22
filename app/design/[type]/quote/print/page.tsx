import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { LABOR_DEFAULTS } from "@/lib/pricing/labor";
import {
  calculateQuote,
  generateQuoteNumber,
} from "@/lib/pricing/quote";
import { MATERIAL_PRICE_PER_BDFT, formatTWD } from "@/lib/pricing/catalog";
import { PrintButton } from "@/components/print/PrintButton";
import { BrandedHeader } from "@/components/branding/BrandedHeader";
import {
  BrandedFooter,
  BrandedSignature,
  BrandedSupplier,
} from "@/components/branding/BrandedSupplier";

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string>>;
}

function parseNum(s: string | undefined, fallback: number): number {
  const n = s ? parseFloat(s) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseOptNum(
  s: string | undefined,
  fallback: number | null,
): number | null {
  if (s === undefined) return fallback;
  if (s.trim() === "") return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0) return null;
  return n;
}

export default async function QuotePrintPage({
  params,
  searchParams,
}: PageProps) {
  const { type } = await params;
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry || !entry.template) notFound();

  const length = parseInt(sp.length ?? "") || entry.defaults.length;
  const width = parseInt(sp.width ?? "") || entry.defaults.width;
  const height = parseInt(sp.height ?? "") || entry.defaults.height;
  const material = (sp.material as MaterialId) ?? "taiwan-cypress";

  const catalogPrimaryPrice = MATERIAL_PRICE_PER_BDFT[material] ?? 300;

  const laborOpts = {
    hourlyRate: parseNum(sp.hourlyRate, LABOR_DEFAULTS.hourlyRate),
    equipmentRate: parseNum(sp.equipmentRate, LABOR_DEFAULTS.equipmentRate),
    consumables: parseNum(sp.consumables, LABOR_DEFAULTS.consumables),
    finishingCost: parseNum(sp.finishingCost, LABOR_DEFAULTS.finishingCost),
    marginRate: parseNum(sp.marginRate, LABOR_DEFAULTS.marginRate),
    vatRate: parseNum(sp.vatRate, LABOR_DEFAULTS.vatRate),
    primaryMaterialPricePerBdft: parseNum(
      sp.primaryMaterialPricePerBdft,
      catalogPrimaryPrice,
    ),
    plywoodPricePerBdft: parseOptNum(
      sp.plywoodPricePerBdft,
      LABOR_DEFAULTS.plywoodPricePerBdft,
    ),
    mdfPricePerBdft: parseOptNum(
      sp.mdfPricePerBdft,
      LABOR_DEFAULTS.mdfPricePerBdft,
    ),
  };

  const design = entry.template({ length, width, height, material });
  const quote = calculateQuote(design, laborOpts);
  const quoteNo = generateQuoteNumber(design.id);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + 14);
  const expiryStr = expiry.toISOString().slice(0, 10);

  return (
    <main className="max-w-[210mm] mx-auto bg-white text-zinc-900 relative">
      <div className="no-print sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          A4 報價單預覽 — 按下按鈕後在系統對話框選擇「另存為 PDF」
        </p>
        <PrintButton />
      </div>

      <div className="print-watermark" aria-hidden>
        <span>木頭仁 · woodenren.com</span>
      </div>

      <section
        data-print-page
        className="px-10 py-10 min-h-[260mm] flex flex-col text-[12px] leading-relaxed"
      >
        {/* Header — branding + quote meta */}
        <header className="flex justify-between items-start border-b-2 border-zinc-900 pb-4">
          <BrandedHeader />
          <div className="text-right text-[11px]">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-zinc-500">報價單號</dt>
              <dd className="font-mono font-semibold text-right">{quoteNo}</dd>
              <dt className="text-zinc-500">開立日期</dt>
              <dd className="font-mono text-right">{todayStr}</dd>
              <dt className="text-zinc-500">有效期限</dt>
              <dd className="font-mono text-right">{expiryStr}</dd>
            </div>
          </div>
        </header>

        {/* Supplier / Customer info */}
        <section className="grid grid-cols-2 gap-4 mt-4">
          <BrandedSupplier />
          <InfoBlock
            title="客戶 TO"
            rows={[
              ["公司／姓名", "＿＿＿＿＿＿＿＿＿＿"],
              ["聯絡人", "＿＿＿＿＿＿＿＿＿＿"],
              ["電話", "＿＿＿＿＿＿＿＿＿＿"],
              ["送貨地址", "＿＿＿＿＿＿＿＿＿＿"],
              ["統編", "＿＿＿＿＿＿＿＿＿＿"],
              ["email", "＿＿＿＿＿＿＿＿＿＿"],
            ]}
          />
        </section>

        {/* Product line item */}
        <section className="mt-6">
          <table className="w-full text-[11px] border border-zinc-400">
            <thead className="bg-zinc-100">
              <tr className="border-b border-zinc-400">
                <th className="text-left p-2 border-r border-zinc-300">
                  品項
                </th>
                <th className="text-left p-2 border-r border-zinc-300">
                  規格
                </th>
                <th className="text-center p-2 border-r border-zinc-300 w-12">
                  數量
                </th>
                <th className="text-right p-2 w-28">金額 NT$</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-300">
                <td className="p-2 border-r border-zinc-300 align-top">
                  <div className="font-semibold">{entry.nameZh}</div>
                  <div className="text-[10px] text-zinc-500">
                    {entry.description}
                  </div>
                </td>
                <td className="p-2 border-r border-zinc-300 align-top text-[10px]">
                  <div>
                    尺寸 {length} × {width} × {height} mm
                  </div>
                  <div>木材：{MATERIALS[material].nameZh}</div>
                  <div>零件數：{design.parts.length} 件</div>
                  <div>
                    榫卯：以 {design.defaultJoinery === "blind-tenon" ? "閉口榫" : design.defaultJoinery} 為主
                  </div>
                  <div>估工：{quote.laborHours.toFixed(1)} 小時</div>
                </td>
                <td className="text-center p-2 border-r border-zinc-300 align-top">
                  1
                </td>
                <td className="text-right p-2 font-mono align-top">
                  {formatTWD(quote.subtotalExclVat)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Cost breakdown */}
        <section className="mt-4">
          <h3 className="text-[11px] font-semibold mb-1 text-zinc-700">
            成本明細
          </h3>
          <table className="w-full text-[10px] border border-zinc-300">
            <tbody>
              {quote.lines.map((line, i) => (
                <tr key={i} className="border-b border-zinc-200">
                  <td className="p-1.5 pl-3 w-28 text-zinc-600">
                    {line.label}
                  </td>
                  <td className="p-1.5 text-zinc-500">{line.detail}</td>
                  <td className="p-1.5 pr-3 text-right font-mono w-28">
                    {formatTWD(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className="mt-4 ml-auto w-80 text-[11px]">
          <table className="w-full">
            <tbody>
              <tr className="border-t border-zinc-300">
                <td className="py-1 text-zinc-600">成本小計</td>
                <td className="py-1 text-right font-mono">
                  {formatTWD(quote.costSubtotal)}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-zinc-600">
                  毛利（{Math.round(laborOpts.marginRate * 100)}%）
                </td>
                <td className="py-1 text-right font-mono">
                  + {formatTWD(quote.margin)}
                </td>
              </tr>
              <tr className="border-t border-zinc-400 font-semibold">
                <td className="py-2">報價（未稅）</td>
                <td className="py-2 text-right font-mono">
                  {formatTWD(quote.subtotalExclVat)}
                </td>
              </tr>
              {laborOpts.vatRate > 0 && (
                <>
                  <tr>
                    <td className="py-1 text-zinc-600">
                      營業稅（{(laborOpts.vatRate * 100).toFixed(0)}%）
                    </td>
                    <td className="py-1 text-right font-mono">
                      + {formatTWD(quote.vat)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-zinc-900 font-bold bg-zinc-900 text-white">
                    <td className="py-2 pl-2">含稅總計 TOTAL</td>
                    <td className="py-2 pr-2 text-right font-mono text-base">
                      {formatTWD(quote.total)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </section>

        {/* Terms & conditions */}
        <section className="mt-6 grid grid-cols-2 gap-4 text-[10px]">
          <InfoBlock
            title="付款條件 PAYMENT TERMS"
            rows={[
              ["訂金", "簽約付款 50%"],
              ["尾款", "交貨前付款 50%"],
              ["匯款銀行", "＿＿＿＿＿＿＿＿"],
              ["帳戶", "＿＿＿＿＿＿＿＿"],
            ]}
          />
          <InfoBlock
            title="交貨與售後 DELIVERY & WARRANTY"
            rows={[
              ["交貨期", "簽約後 ____ 天內"],
              ["交貨方式", "工坊自取／另議運費"],
              ["保固", "一年（非人為損害）"],
              ["售後服務", "終身榫卯維修"],
            ]}
          />
        </section>

        <section className="mt-4 p-3 border border-zinc-300 rounded text-[10px] leading-relaxed">
          <p className="font-semibold mb-1">備註 NOTES</p>
          <ul className="list-disc pl-4 space-y-0.5 text-zinc-700">
            <li>本報價含材料、加工、組裝、表面塗裝。不含跨區運輸與現場安裝。</li>
            <li>木材依實際乾燥度、紋理挑選會有 ±3% 尺寸與色差誤差。</li>
            <li>客製樣式確認後如欲修改設計，需重新報價。</li>
            <li>如需開立發票（營業稅 5%），請於下訂時告知。</li>
          </ul>
        </section>

        {/* Signatures */}
        <section className="mt-auto pt-8 grid grid-cols-2 gap-6 text-[11px]">
          <div>
            <div className="h-20 border-b border-zinc-400" />
            <div className="mt-1 flex justify-between text-zinc-600">
              <span>客戶簽章</span>
              <span>日期：＿＿＿＿ / ＿＿ / ＿＿</span>
            </div>
          </div>
          <div>
            <div className="h-20 border-b border-zinc-400 flex items-end justify-end pr-4">
              <span className="text-[10px] text-zinc-400">（本公司用印）</span>
            </div>
            <BrandedSignature todayStr={todayStr} />
          </div>
        </section>

        <BrandedFooter />
      </section>
    </main>
  );
}

function InfoBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="border border-zinc-300 rounded">
      <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
        {title}
      </div>
      <dl className="p-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="text-zinc-900 font-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
