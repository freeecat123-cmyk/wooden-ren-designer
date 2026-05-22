-- 問卷系統：
--   survey_responses: 每人對某個問卷的作答（answers jsonb 自由格式）
--   survey_coupons:   填完問卷自動發的折扣 code（每人每問卷唯一一張）
--
-- 問卷本身（題目/選項/標題）寫在 lib/survey/configs.ts 硬碼，
-- 不放 DB（problem-specific、不需要 admin 改題；要改新題重新部署就好）。
--
-- coupon 兌換流程（MVP）：
--   user 在 /pricing 結帳時輸入 code，後端 query survey_coupons.used=false
--   → 套用折扣（這部分另外做 ECPay 整合，本 migration 只負責記錄）。
--   現階段 admin 可直接 SQL 查 code 對應的折扣 % 手動退費。

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- survey config 的 key（e.g. "launch-2026-05"）
  survey_id text not null,
  -- 自由格式 answers：{ q1: "personal", q2: ["youtube","fb"], q7: "希望加榻榻米" }
  answers jsonb not null,
  created_at timestamptz not null default now(),
  -- 提交當下發給這位填卷者的 coupon code（指向 survey_coupons.code）
  coupon_code text,
  -- 同一 user 同一 survey 只能填一次（換個角度看也防灌票）
  unique (user_id, survey_id)
);

create index if not exists survey_responses_survey_created_idx
  on public.survey_responses (survey_id, created_at desc);

create table if not exists public.survey_coupons (
  code text primary key,
  survey_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 折扣百分比（50 = 半價）
  discount_percent int not null,
  -- 折扣到期日（過了就不能兌換）
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists survey_coupons_user_idx
  on public.survey_coupons (user_id);

-- RLS：admin 用 service role 寫；user 可讀自己的 coupon（之後 /pricing 結帳檢查）。
alter table public.survey_responses enable row level security;
alter table public.survey_coupons enable row level security;

-- user 可以讀自己 issue 出來的 coupon（結帳時前端要顯示「你有 50% off」）
create policy "user reads own coupon"
  on public.survey_coupons
  for select
  using (auth.uid() = user_id);

-- user 可以查自己的問卷作答（防重複作答前端先 query）
create policy "user reads own response"
  on public.survey_responses
  for select
  using (auth.uid() = user_id);

comment on table public.survey_responses is '使用者問卷作答紀錄（answers 是自由格式 jsonb）';
comment on table public.survey_coupons is '填卷自動發放的折扣 code，user 可讀自己的';
