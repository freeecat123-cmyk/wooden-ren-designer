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
  expires_at: string | null;
  /** 公開備註（會顯示在報價單給客戶看）*/
  notes: string | null;
  /** 內部備註（業主看不到，給設計師/木匠做筆記，per migration 20260429）*/
  internal_notes: string | null;
  /** 訂金收款日（null = 尚未收，per migration 20260429）*/
  deposit_received_at: string | null;
  /** 尾款收款日（null = 尚未收，per migration 20260429）*/
  balance_received_at: string | null;
  /** 手動覆寫的預計完工日（null = 用估算值，per migration 20260429）*/
  delivery_date_override: string | null;
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
