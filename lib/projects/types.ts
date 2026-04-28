export type ProjectStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "in_production"
  | "delivered"
  | "cancelled";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "草稿",
  sent: "已寄提案",
  confirmed: "已成交",
  in_production: "施作中",
  delivered: "已交貨",
  cancelled: "已取消",
};

/** 專案層的報價設定。每個欄位都是 optional（null 沿用 LABOR_DEFAULTS）。 */
export interface ProjectLaborOpts {
  hourlyRate?: number;
  marginRate?: number;
  finishingCost?: number;
  shippingCost?: number;
  installationCost?: number;
  hardwareCost?: number;
  vatRate?: number;
  discountRate?: number;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  customer_name: string | null;
  customer_contact: string | null;
  project_address: string | null;
  design_concept: string | null;
  status: ProjectStatus;
  deposit_rate: number;
  labor_opts: ProjectLaborOpts | null;
  share_token: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectItemRow {
  id: string;
  project_id: string;
  design_id: string | null;
  furniture_type: string;
  name: string;
  params: Record<string, unknown>;
  quantity: number;
  unit_price_override: number | null;
  room: string | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
}
