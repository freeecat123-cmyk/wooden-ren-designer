import { MATERIALS, type MaterialSpec, materialName, materialNotes } from "@/lib/materials";
import type { MaterialId } from "@/lib/types";

/**
 * 木材立體屬性面板（per drafting-math.md §AC9）
 *
 * 6 軸雷達圖（硬度 / 加工性 / 耐候 / 香氣 / 環保 / 便宜）+ 屬性 chips
 * + CITES 警示。讓選材從「顏色 + 硬度數字」升級到 6 維資訊。
 */
const AXES = [
  { key: "hardness5", labelZh: "硬度", labelEn: "Hardness", emoji: "💪" },
  { key: "workability", labelZh: "好做", labelEn: "Workability", emoji: "🛠️" },
  { key: "durability", labelZh: "耐候", labelEn: "Durability", emoji: "☔" },
  { key: "aroma", labelZh: "香氣", labelEn: "Aroma", emoji: "🌿" },
  { key: "ecoScore", labelZh: "環保", labelEn: "Eco", emoji: "🌱" },
  { key: "affordability", labelZh: "便宜", labelEn: "Price", emoji: "💰" },
] as const;

function RadarChart({ values, locale }: { values: number[]; locale: string }) {
  const isEn = locale === "en";
  const size = 140;
  const center = size / 2;
  const maxR = size / 2 - 18;
  const n = values.length;
  const angles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (i / n) * Math.PI * 2);
  const points = values.map((v, i) => {
    const r = (v / 5) * maxR;
    return [center + r * Math.cos(angles[i]), center + r * Math.sin(angles[i])];
  });
  const polygon = points.map((p) => p.join(",")).join(" ");

  const rings = [1, 2, 3, 4, 5].map((step) => {
    const r = (step / 5) * maxR;
    const verts = angles.map((a) => `${center + r * Math.cos(a)},${center + r * Math.sin(a)}`).join(" ");
    return verts;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((verts, i) => (
        <polygon
          key={i}
          points={verts}
          fill={i === 4 ? "#fafaf7" : "none"}
          stroke="#e5e5e5"
          strokeWidth={0.5}
        />
      ))}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={center + maxR * Math.cos(a)}
          y2={center + maxR * Math.sin(a)}
          stroke="#e5e5e5"
          strokeWidth={0.5}
        />
      ))}
      <polygon points={polygon} fill="#f59e0b" fillOpacity={0.25} stroke="#d97706" strokeWidth={1.2} />
      {AXES.map((axis, i) => {
        const a = angles[i];
        const r = maxR + 12;
        const tx = center + r * Math.cos(a);
        const ty = center + r * Math.sin(a);
        return (
          <text
            key={axis.key}
            x={tx}
            y={ty}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill="#52525b"
          >
            {isEn ? axis.labelEn : axis.labelZh}
          </text>
        );
      })}
    </svg>
  );
}

const STYLE_LABEL_ZH: Record<string, string> = {
  ming: "明式",
  qing: "清式",
  "neo-cn": "新中式",
  jp: "日式",
  nordic: "北歐",
  "american-craft": "美式工藝",
  colonial: "殖民風",
  industrial: "工業",
};

const STYLE_LABEL_EN: Record<string, string> = {
  ming: "Ming",
  qing: "Qing",
  "neo-cn": "Neo-Chinese",
  jp: "Japanese",
  nordic: "Scandinavian",
  "american-craft": "American craft",
  colonial: "Colonial",
  industrial: "Industrial",
};

function MaterialBadges({ spec, locale }: { spec: MaterialSpec; locale: string }) {
  if (!spec.attrs) return null;
  const a = spec.attrs;
  const isEn = locale === "en";
  const badges: { label: string; tone: "amber" | "rose" | "sky" | "emerald" }[] = [];
  if (a.cites) badges.push({ label: `⚠ CITES ${a.cites}`, tone: "rose" });
  if (a.oilyHardToGlue) badges.push({ label: isEn ? "⚠ Oily, hard to glue" : "⚠ 油性難黏", tone: "amber" });
  if (a.outdoor) badges.push({ label: isEn ? "Outdoor OK" : "戶外可用", tone: "emerald" });
  if (a.aroma >= 4) badges.push({ label: isEn ? "Aromatic" : "香氣濃", tone: "emerald" });
  return badges.length ? (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {badges.map((b, i) => (
        <span
          key={i}
          className={`text-[10px] px-1.5 py-0.5 rounded border ${
            b.tone === "rose"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : b.tone === "amber"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : b.tone === "sky"
                  ? "bg-sky-50 border-sky-200 text-sky-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {b.label}
        </span>
      ))}
    </div>
  ) : null;
}

interface MaterialAttributesPanelProps {
  materialId: MaterialId;
  locale?: string;
}

export function MaterialAttributesPanel({ materialId, locale = "zh-TW" }: MaterialAttributesPanelProps) {
  const spec = MATERIALS[materialId];
  if (!spec || !spec.attrs) return null;
  const a = spec.attrs;
  const isEn = locale === "en";
  const values = AXES.map((axis) => a[axis.key] as number);
  const STYLE_LABEL = isEn ? STYLE_LABEL_EN : STYLE_LABEL_ZH;
  return (
    <div className="mt-2 mb-4 rounded-lg border border-zinc-200 bg-white p-3 flex items-center gap-3">
      <div className="shrink-0">
        <RadarChart values={values} locale={locale} />
      </div>
      <div className="flex-1 min-w-0 text-[11px] text-zinc-700">
        <div className="font-semibold text-zinc-900 text-xs mb-0.5">
          {materialName(materialId, locale)}
          <span className="ml-1 text-zinc-400 font-normal">
            {isEn ? spec.nameZh : spec.nameEn}
          </span>
        </div>
        <div className="text-zinc-500 mb-1">
          {isEn
            ? `Density ${spec.density} kg/m³ · Janka ${spec.hardness} N`
            : `密度 ${spec.density} kg/m³ · Janka ${spec.hardness} N`}
        </div>
        {(() => {
          const note = materialNotes(materialId, locale);
          return note ? <div className="text-zinc-600 mb-1 leading-relaxed">{note}</div> : null;
        })()}
        {a.styles.length > 0 && (
          <div className="text-zinc-500">
            {isEn ? "Suits: " : "適合："}
            {a.styles.map((s, i) => (
              <span key={s} className="text-zinc-700">
                {i > 0 && (isEn ? ", " : "、")}
                {STYLE_LABEL[s] ?? s}
              </span>
            ))}
          </div>
        )}
        <MaterialBadges spec={spec} locale={locale} />
      </div>
    </div>
  );
}
