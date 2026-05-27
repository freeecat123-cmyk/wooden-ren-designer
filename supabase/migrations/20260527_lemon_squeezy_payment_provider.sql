-- =============================================================================
-- Lemon Squeezy 國際版金流支援
--
-- 既有金流：ECPay（台灣 ATM/超商/信用卡）
-- 新增金流：Lemon Squeezy（國際信用卡 + MoR 自動處理 VAT/稅務）
--
-- 共存策略：locale 分流（zh-TW → ECPay / en → Lemon Squeezy）
-- 兩 provider 共用 subscriptions / payments / template_unlocks / tool_unlocks
-- 四張表，用 payment_provider 欄區分來源。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. subscriptions：加 provider + LS 識別欄
-- -----------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists payment_provider text
    not null default 'ecpay'
    check (payment_provider in ('ecpay', 'lemonsqueezy'));

alter table public.subscriptions
  add column if not exists lemonsqueezy_subscription_id text;

alter table public.subscriptions
  add column if not exists lemonsqueezy_order_id text;

create unique index if not exists subscriptions_lemonsqueezy_sub_id_uniq
  on public.subscriptions (lemonsqueezy_subscription_id)
  where lemonsqueezy_subscription_id is not null;

create index if not exists subscriptions_payment_provider_idx
  on public.subscriptions (payment_provider);

comment on column public.subscriptions.payment_provider is
  '金流來源 ecpay (台灣) | lemonsqueezy (國際)，default ecpay 保留歷史資料相容';
comment on column public.subscriptions.lemonsqueezy_subscription_id is
  'LS subscription ID，供 cancel / update / replay 防重時查詢';

-- -----------------------------------------------------------------------------
-- 2. payments：加 provider + LS order 識別
-- -----------------------------------------------------------------------------
alter table public.payments
  add column if not exists payment_provider text
    not null default 'ecpay'
    check (payment_provider in ('ecpay', 'lemonsqueezy'));

alter table public.payments
  add column if not exists lemonsqueezy_order_id text;

create unique index if not exists payments_lemonsqueezy_order_id_uniq
  on public.payments (lemonsqueezy_order_id)
  where lemonsqueezy_order_id is not null;

create index if not exists payments_payment_provider_idx
  on public.payments (payment_provider);

comment on column public.payments.lemonsqueezy_order_id is
  'LS order ID，webhook replay 防重靠這個 unique';

-- -----------------------------------------------------------------------------
-- 3. template_unlocks：加 provider + LS order
-- -----------------------------------------------------------------------------
alter table public.template_unlocks
  add column if not exists payment_provider text
    not null default 'ecpay'
    check (payment_provider in ('ecpay', 'lemonsqueezy'));

alter table public.template_unlocks
  add column if not exists lemonsqueezy_order_id text;

create index if not exists template_unlocks_lemonsqueezy_order_idx
  on public.template_unlocks (lemonsqueezy_order_id)
  where lemonsqueezy_order_id is not null;

-- -----------------------------------------------------------------------------
-- 4. tool_unlocks：加 provider + LS order
-- -----------------------------------------------------------------------------
alter table public.tool_unlocks
  add column if not exists payment_provider text
    not null default 'ecpay'
    check (payment_provider in ('ecpay', 'lemonsqueezy'));

alter table public.tool_unlocks
  add column if not exists lemonsqueezy_order_id text;

create index if not exists tool_unlocks_lemonsqueezy_order_idx
  on public.tool_unlocks (lemonsqueezy_order_id)
  where lemonsqueezy_order_id is not null;

-- -----------------------------------------------------------------------------
-- 5. lemonsqueezy_webhook_log：raw event log + idempotency
-- -----------------------------------------------------------------------------
-- LS 推 webhook 偶爾會重送，用 event_id unique 擋重複處理。
-- raw_payload 保留 90 天給 debug 用。
create table if not exists public.lemonsqueezy_webhook_log (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_name text not null,
  raw_payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create index if not exists lemonsqueezy_webhook_log_event_name_idx
  on public.lemonsqueezy_webhook_log (event_name);

create index if not exists lemonsqueezy_webhook_log_unprocessed_idx
  on public.lemonsqueezy_webhook_log (created_at)
  where processed_at is null;

alter table public.lemonsqueezy_webhook_log enable row level security;
-- 只有 service_role 能存取（webhook 走 service_role）
-- 不建任何 policy = authenticated default deny

comment on table public.lemonsqueezy_webhook_log is
  'LS webhook raw event log，event_id unique 擋 replay。service_role only';
