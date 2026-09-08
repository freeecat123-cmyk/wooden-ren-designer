import { categoryLabel } from "@/lib/templates/labels";
import type { FurnitureCategory } from "@/lib/types";

export interface DesignRow {
  id: string;
  furniture_type: string;
  name: string | null;
  params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type DesignSort = "updated" | "name";
export const normalizeCategory = (type: string) => type.trim().toLowerCase().replace(/_/g, "-");
export const categoryName = (type: string, locale: string) => categoryLabel(normalizeCategory(type) as FurnitureCategory, locale);
export const designName = (row: DesignRow, locale: string) => row.name?.trim() || categoryName(row.furniture_type, locale);

// Verified files in public/thumbs/v2. These are category samples, not saved geometry.
const imageCategories = new Set([
  "stool", "bench", "tea-table", "side-table", "low-table", "open-bookshelf",
  "chest-of-drawers", "chinese-cabinet", "shoe-cabinet", "display-cabinet",
  "dining-table", "desk", "dining-chair", "wardrobe", "bar-stool", "media-console",
  "nightstand", "round-stool", "round-tea-table", "round-table", "pencil-holder",
  "bookend", "photo-frame", "tray", "dovetail-box", "wine-rack", "bed", "coat-rack", "workbench",
]);
export function categoryImage(type: string): string | null {
  const category = normalizeCategory(type);
  return imageCategories.has(category) ? `/thumbs/v2/${category}.webp` : null;
}

export function buildEditHref(row: DesignRow): string {
  return `/design/${encodeURIComponent(normalizeCategory(row.furniture_type))}?designId=${encodeURIComponent(row.id)}&loadSaved=1`;
}

export function selectDesigns(rows: DesignRow[], search: string, category: string, sort: DesignSort, locale: string): DesignRow[] {
  const query = search.trim().toLocaleLowerCase(locale);
  const selected = normalizeCategory(category);
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  return rows.filter(row => (!selected || normalizeCategory(row.furniture_type) === selected) &&
    (!query || [designName(row, locale), categoryName(row.furniture_type, locale), normalizeCategory(row.furniture_type)]
      .some(value => value.toLocaleLowerCase(locale).includes(query))))
    .sort((a, b) => sort === "name"
      ? collator.compare(designName(a, locale), designName(b, locale))
      : (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0));
}

type PageResult = { data: DesignRow[] | null; error: { message: string } | null };
export async function fetchAllDesigns(
  page: (from: number, to: number) => PromiseLike<PageResult>,
  signal?: AbortSignal,
): Promise<DesignRow[]> {
  const rows: DesignRow[] = [];
  let offset = 0;
  for (;;) {
    signal?.throwIfAborted();
    const { data, error } = await page(offset, offset + 499);
    signal?.throwIfAborted();
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data);
    // Continue until empty, not until short: the server cap can be below 500.
    offset += data.length;
  }
}
