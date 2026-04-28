-- 專案層級的報價設定（時薪/毛利/塗裝/折扣/稅...）
-- 同一個專案內所有家具的「帶入估價」都用這套，無設定時 fallback 到 LABOR_DEFAULTS
alter table public.projects
  add column if not exists labor_opts jsonb;

comment on column public.projects.labor_opts is
  'Subset of LaborDefaults applied to all items in this project. Null = use system LABOR_DEFAULTS.';
