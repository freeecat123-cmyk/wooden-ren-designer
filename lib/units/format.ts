/**
 * Imperial / metric length formatting.
 *
 * Why we have this:
 *   The whole codebase stores geometry in mm. When the user picks the EN locale
 *   (or, eventually, an explicit unit toggle) they expect imperial fractions —
 *   38mm displayed as `1-1/2"`, not `1.5"` and definitely not `1.4960629921"`.
 *   1/16" is the practical floor for hand woodworking; anything finer is noise.
 *
 * Output convention (`formatInchFraction`):
 *   - Whole inches:        `2"`
 *   - Mixed:               `1-1/2"`  (dash separator, not space — survives
 *                                     copy/paste into spreadsheets without
 *                                     accidental line wraps)
 *   - Fraction only:       `3/4"`
 *   - Reduced fractions:   `8/16 → 1/2`, `12/16 → 3/4`
 *   - Zero:                `0"`
 *   - Rounds-up to whole:  `15.9/16` of an inch (= 25.3mm) rounds to `1"`.
 */

export const MM_PER_INCH = 25.4;

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/**
 * Round an mm value to the nearest 1/`denominator` inch and format as a
 * proper imperial fraction with a trailing inch mark.
 *
 * Negative values are preserved with a leading `-`.
 */
export function formatInchFraction(mm: number, denominator = 16): string {
  if (!Number.isFinite(mm)) return "—";
  const sign = mm < 0 ? "-" : "";
  const absMm = Math.abs(mm);

  const totalSixteenths = Math.round(mmToInches(absMm) * denominator);
  if (totalSixteenths === 0) return `${sign}0"`;

  const whole = Math.floor(totalSixteenths / denominator);
  let num = totalSixteenths % denominator;
  let den = denominator;
  if (num > 0) {
    const g = gcd(num, den);
    num /= g;
    den /= g;
  }

  if (num === 0) return `${sign}${whole}"`;
  if (whole === 0) return `${sign}${num}/${den}"`;
  return `${sign}${whole}-${num}/${den}"`;
}

/**
 * High-level: pick mm display (`"38 mm"` style trim — integer when round,
 * 1 decimal otherwise) or imperial fraction based on `unit`.
 *
 * Call sites that only know `locale` can use
 *   `formatLength(mm, locale === "en" ? "inch" : "mm")`.
 */
export function formatLength(mm: number, unit: "mm" | "inch"): string {
  if (unit === "inch") return formatInchFraction(mm);
  if (!Number.isFinite(mm)) return "—";
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} mm` : `${rounded.toFixed(1)} mm`;
}

/**
 * Same as `formatLength` but returns the bare number/fraction without a unit
 * suffix — for tables like the BOM where the column header already says "(mm)"
 * or "(in)" and a per-cell suffix would be noisy.
 */
export function formatLengthBare(mm: number, unit: "mm" | "inch"): string {
  if (unit === "inch") return formatInchFraction(mm).replace(/"$/, "");
  if (!Number.isFinite(mm)) return "—";
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
