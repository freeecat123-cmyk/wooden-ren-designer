import { CustomersClient } from "@/components/projects/CustomersClient";
import { createClient } from "@/lib/supabase/server";
import type { ProjectRow, ProjectItemRow } from "@/lib/projects/types";

export const metadata = {
  title: "客戶名單 · 木頭仁工程圖生成器",
};

export interface CustomerSummary {
  /** 客戶名稱（trim 後）做 key */
  name: string;
  contact: string | null;
  address: string | null;
  projectCount: number;
  totalRevenue: number;
  lastUpdated: string;
  /** 最近的一個 project，給快速進入 */
  latestProjectId: string;
}

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let customers: CustomerSummary[] = [];

  if (user) {
    const [{ data: projectsData }, { data: itemsData }] = await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("project_items")
        .select("project_id, quantity, unit_price_override"),
    ]);
    const projects = (projectsData ?? []) as ProjectRow[];
    const items = (itemsData ?? []) as Array<
      Pick<ProjectItemRow, "project_id" | "quantity" | "unit_price_override">
    >;

    const totalsByProject = new Map<string, number>();
    for (const it of items) {
      const u = it.unit_price_override ?? 0;
      totalsByProject.set(
        it.project_id,
        (totalsByProject.get(it.project_id) ?? 0) + u * it.quantity,
      );
    }

    const map = new Map<string, CustomerSummary>();
    for (const p of projects) {
      const key = p.customer_name?.trim() || "";
      if (!key) continue;
      const total = totalsByProject.get(p.id) ?? 0;
      const existing = map.get(key);
      if (existing) {
        existing.projectCount += 1;
        existing.totalRevenue += total;
        if (p.updated_at > existing.lastUpdated) {
          existing.lastUpdated = p.updated_at;
          existing.latestProjectId = p.id;
          existing.contact = p.customer_contact ?? existing.contact;
          existing.address = p.project_address ?? existing.address;
        }
      } else {
        map.set(key, {
          name: key,
          contact: p.customer_contact?.trim() || null,
          address: p.project_address?.trim() || null,
          projectCount: 1,
          totalRevenue: total,
          lastUpdated: p.updated_at,
          latestProjectId: p.id,
        });
      }
    }
    customers = [...map.values()].sort((a, b) =>
      b.lastUpdated.localeCompare(a.lastUpdated),
    );
  }

  return <CustomersClient initial={customers} loggedIn={!!user} />;
}
