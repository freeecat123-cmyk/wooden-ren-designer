"use client";

/**
 * Label suffix that flips "mm" → "in" when the user picks inch.
 * Used next to "Width / Depth / Height" labels and any spec input
 * whose underlying unit is mm. The actual stored value is always mm —
 * this is display only.
 */

import { useUnit } from "@/hooks/useUnit";

export function UnitSuffix({
  mmLabel = "mm",
  inchLabel = "in",
  className = "text-zinc-400 font-normal ml-0.5",
}: {
  mmLabel?: string;
  inchLabel?: string;
  className?: string;
}) {
  const unit = useUnit();
  return <span className={className}>{unit === "inch" ? inchLabel : mmLabel}</span>;
}
