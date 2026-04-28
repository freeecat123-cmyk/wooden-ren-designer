import { MATERIALS, type MaterialSpec } from "@/lib/materials";
import type { MaterialId } from "@/lib/types";

/**
 * 木材立體屬性面板（per drafting-math.md §AC9）
 *
 * 6 軸雷達圖（硬度 / 加工性 / 耐候 / 香氣 / 環保 / 便宜）+ 屬性 chips
 * + CITES 警示。讓選材從「顏色 + 硬度數字」升級到 6 維資訊。
 */
const AXES = [
  { key: "hardness5", label: "硬度", emoji: "💪" },
  { key: "workability", label: "好做", emoji: "🛠️" },
  { key: "durability", label: "耐候", emoji: "☔" },
  { key: "aroma", label: "香氣", emoji: "🌿" },
  { key: "ecoScore", label: "環保", emoji: "🌱" },
  { key: "affordability", label: "便宜", emoji: "💰" },
] as const;

function RadarChart({ values }: { values: number[] }) {
  const size = 140;
  const center = size / 2;
  const maxR = size / 2 - 18;
  const n = values.length;
  // 6 個軸的角度（從 12 點鐘起順時針）
  const angles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (i / n) * Math.PI * 2);
  const points = values.map((v, i) => {
    const r = (v / 5) * maxR;
    return [center + r * Math.cos(angles[i]), center + r * Math.sin(angles[i])];
  });
  const polygon = points.map((p) => p.join(",")).join(" ");

  // 背景同心格（5 圈）
  const rings = [1, 2, 3, 4, 5].map((step) => {
    const r = (step / 5) * maxR;
    const verts = angles.map((a) => `${center + r * Math.cos(a)},${center + r * Math.sin(a)}`).join(" ");
    return verts;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 背景同心多邊形 */}
      {rings.map((verts, i) => (
        <polygon
          key={i}
          points={verts}
          fill={i === 4 ? "#fafaf7" : "none"}
          stroke="#e5e5e5"
          strokeWidth={0.5}
        />
      ))}
      {/* 軸線 */}
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
      {/* 屬性多邊形 */}
      <polygon points={polygon} fill="#f59e0b" fillOpacity={0.25} stroke="#d97706" strokeWidth={1.2} />
      {/* 軸標籤 */}
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
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

const STYLE_LABEL: Record<string, string> = {
  ming: "明式",
  qing: "清式",
  "neo-cn": "新中式",
  jp: "日式",
  nordic: "北歐",
  "american-craft": "美式工藝",
  colonial: "殖民風",
  industrial: "工業",
};

function MaterialBadges({ spec }: { spec: MaterialSpec }) {
  if (!spec.attrs) return null;
  const a = spec.attrs;
  const badges: { label: string; tone: "amber" | "rose" | "sky" | "emerald" }[] = [];
  if (a.cites) badges.push({ label: `⚠ CITES ${a.cites}`, tone: "rose" });
  if (a.oilyHardToGlue) badges.push({ label: "⚠ 油性難黏", tone: "amber" });
  if (a.outdoor) badges.push({ label: "戶外可用", tone: "emerald" });
  if (a.aroma >= 4) badges.push({ label: "香氣濃", tone: "emerald" });
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

export function MaterialAttributesPanel({ materialId }: { materialId: MaterialId }) {
  const spec = MATERIALS[materialId];
  if (!spec || !spec.attrs) return null;
  const a = spec.attrs;
  const values = AXES.map((axis) => a[axis.key] as number);
  return (
    <div className="mt-2 mb-4 rounded-lg border border-zinc-200 bg-white p-3 flex items-center gap-3">
      <div className="shrink-0">
        <RadarChart values={values} />
      </div>
      <div className="flex-1 min-w-0 text-[11px] text-zinc-700">
        <div className="font-semibold text-zinc-900 text-xs mb-0.5">
          {spec.nameZh}
          <span className="ml-1 text-zinc-400 font-normal">{spec.nameEn}</span>
        </div>
        <div className="text-zinc-500 mb-1">
          密度 {spec.density} kg/m³ · Janka {spec.hardness} N
        </div>
        {spec.notes && <div className="text-zinc-600 mb-1 leading-relaxed">{spec.notes}</div>}
        {a.styles.length > 0 && (
          <div className="text-zinc-500">
            適合：
            {a.styles.map((s, i) => (
              <span key={s} className="text-zinc-700">
                {i > 0 && "、"}
                {STYLE_LABEL[s] ?? s}
              </span>
            ))}
          </div>
        )}
        <MaterialBadges spec={spec} />
      </div>
    </div>
  );
}
