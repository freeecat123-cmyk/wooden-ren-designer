/**
 * 範本頁「常見尺寸」段（2026-09-04）。純 server component：
 * 表格數字來自 lib/templates/sizing.ts（程式常數），怎麼抓的句子來自 sizing-notes.ts。
 * 樣式沿用 templates/[type]/page.tsx 既有的 stone / amber / zinc 類別，不引新色。
 */
import type { FurnitureCatalogEntry } from "@/lib/templates";
import { formatSizingRange, formatSizingValue, getSizingRows } from "@/lib/templates/sizing";
import { getSizingNotes } from "@/lib/templates/sizing-notes";

interface Labels {
  h2: string;
  subtitle: string;
  colDimension: string;
  colRange: string;
  colDefault: string;
  notesH3: string;
  footnote: string;
}

export function TemplateSizingSection({
  entry,
  locale,
  labels,
}: {
  entry: FurnitureCatalogEntry;
  locale: string;
  labels: Labels;
}) {
  const rows = getSizingRows(entry, locale);
  const notes = getSizingNotes(entry.category, locale);
  return (
    <section
      className="bg-stone-50 border-y border-stone-200"
      data-testid="template-sizing"
    >
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
          {labels.h2}
        </h2>
        <p className="text-zinc-500 mb-7">{labels.subtitle}</p>
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-100 text-zinc-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{labels.colDimension}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{labels.colRange}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{labels.colDefault}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-stone-200">
                  <th scope="row" className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                    {r.label}
                  </th>
                  <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">
                    {formatSizingRange(r, locale)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">
                    {formatSizingValue(r.defaultValue, r.unit, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">{labels.footnote}</p>
        {notes.length > 0 && (
          <div className="mt-8">
            <h3 className="font-bold text-zinc-900 mb-3">{labels.notesH3}</h3>
            <ul className="space-y-2 text-zinc-700 leading-relaxed list-disc pl-5">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
