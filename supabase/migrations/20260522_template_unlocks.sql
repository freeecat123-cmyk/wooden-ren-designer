-- template_unlocks：單範本永久買斷紀錄
-- 每筆 = user X 對 category Y 永久解鎖（不過期、不續扣）
-- 同 user 同 category 唯一,重複買會被 ECPay create-order 端擋（先 check 再下單）
--
-- 為什麼跟 subscriptions 分開:
--   - subscriptions 有到期日 / 狀態 / 退費邏輯,unlocks 永久單向
--   - 一個 user 可同時有訂閱 + 多個範本買斷,兩個 source of truth 互不干涉
--   - canAccessCategory 查兩張表 OR 邏輯（任一通過就放）

create table if not exists public.template_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 對應 FurnitureCategory（lib/types/index.ts）
  category text not null,
  -- 買的時候的價格快照（之後改價不影響歷史）
  paid_amount int not null,
  -- 對應的 ECPay merchant_trade_no（webhook 比對用）
  ecpay_merchant_trade_no text,
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

create index if not exists template_unlocks_user_idx
  on public.template_unlocks (user_id);

create index if not exists template_unlocks_trade_no_idx
  on public.template_unlocks (ecpay_merchant_trade_no)
  where ecpay_merchant_trade_no is not null;

-- RLS:user 可讀自己的 unlocks（前端要顯示「我有解這張」）
alter table public.template_unlocks enable row level security;

create policy "user reads own unlocks"
  on public.template_unlocks
  for select
  using (auth.uid() = user_id);

comment on table public.template_unlocks is
  '單範本永久買斷紀錄,跟 subscriptions 互補。canAccessCategory 查兩張表 OR 邏輯';
