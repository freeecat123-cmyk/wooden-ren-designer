import { createClient as createServerClient, createAdminClient } from "@/lib/supabase/server";
import type { ProjectItemRow, ProjectRow } from "@/lib/projects/types";

/** 從 user_branding 表撈出來的子集，用於 server-render BrandedHeader（客戶端不再讀 localStorage）。 */
export interface OwnerBranding {
  companyNameZh: string;
  tagline: string;
  logoDataUrl: string;
  address: string;
  phone: string;
  email: string;
  contact: string;
}

export const DEFAULT_OWNER_BRANDING: OwnerBranding = {
  companyNameZh: "",
  tagline: "",
  logoDataUrl: "",
  address: "",
  phone: "",
  email: "",
  contact: "",
};

export interface ProjectQuoteData {
  project: ProjectRow;
  items: ProjectItemRow[];
  /** 專案擁有者（木工）的品牌資料；客戶端就直接 render 這份，不再讀 localStorage */
  branding: OwnerBranding;
  /** true 表示是用 share_token 公開讀的（客戶視角），可拿來決定隱藏編輯按鈕 */
  publicAccess: boolean;
}

async function fetchOwnerBranding(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<OwnerBranding> {
  const { data: row } = await admin
    .from("user_branding")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row?.data) return DEFAULT_OWNER_BRANDING;
  const d = row.data as Record<string, unknown>;
  return {
    companyNameZh: (d.companyNameZh as string) ?? "",
    tagline: (d.tagline as string) ?? "",
    logoDataUrl: (d.logoDataUrl as string) ?? "",
    address: (d.address as string) ?? "",
    phone: (d.phone as string) ?? "",
    email: (d.email as string) ?? "",
    contact: (d.contact as string) ?? "",
  };
}

/**
 * 抓專案報價需要的資料。三條進入路徑：
 *  1. 有 ?token=xxx → 用 admin client 比對 share_token，繞 RLS 公開讀（給木工的客戶）
 *  2. 已登入 + 是擁有者 → 走 RLS 正常讀
 *  3. 都不符合 → 回 null
 */
export async function fetchProjectQuoteData(
  projectId: string,
  token: string | null,
): Promise<ProjectQuoteData | null> {
  const admin = createAdminClient();
  if (token) {
    const { data: project } = await admin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("share_token", token)
      .maybeSingle();
    if (!project) return null;
    const proj = project as ProjectRow;
    const [{ data: items }, branding] = await Promise.all([
      admin
        .from("project_items")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      fetchOwnerBranding(admin, proj.user_id),
    ]);
    return {
      project: proj,
      items: (items ?? []) as ProjectItemRow[],
      branding,
      publicAccess: true,
    };
  }

  const supabase = await createServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;
  const proj = project as ProjectRow;
  const [{ data: items }, branding] = await Promise.all([
    supabase
      .from("project_items")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    fetchOwnerBranding(admin, proj.user_id),
  ]);
  return {
    project: proj,
    items: (items ?? []) as ProjectItemRow[],
    branding,
    publicAccess: false,
  };
}
