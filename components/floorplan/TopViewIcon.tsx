import { isPartHidden, projectPart, sortPartsByDepth } from "@/lib/render/geometry";
import type { FurnitureDesign } from "@/lib/types";

interface Props {
  design: FurnitureDesign;
}

/**
 * 給配置圖用的精簡俯視 icon SVG：只畫 parts，無標題列、無尺寸線、無中心十字。
 * viewBox 單位 = mm（與 overall.length / overall.width 一致），以家具中心為原點。
 */
export function TopViewIcon({ design }: Props) {
  const w = design.overall.length;
  const h = design.overall.width;
  const minDim = Math.min(w, h);
  const partStroke = Math.max(1.5, minDim * 0.004);
  const outerStroke = Math.max(2.5, minDim * 0.006);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill="#fafaf9"
        stroke="#27272a"
        strokeWidth={outerStroke}
      />
      {sortPartsByDepth(design.parts, "top").map((part, i) => {
        const hidden = isPartHidden(part, design.parts, "top");
        if (hidden) return null;
        const r = projectPart(part, "top");

        const isRound =
          part.shape?.kind === "round" ||
          part.shape?.kind === "round-tapered" ||
          part.shape?.kind === "splayed-round-tapered" ||
          part.shape?.kind === "lathe-turned";

        if (isRound) {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const radius = Math.min(r.w, r.h) / 2;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="#d4d4d8"
              stroke="#27272a"
              strokeWidth={partStroke}
            />
          );
        }

        return (
          <rect
            key={i}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill="#e4e4e7"
            stroke="#27272a"
            strokeWidth={partStroke}
          />
        );
      })}
    </svg>
  );
}
