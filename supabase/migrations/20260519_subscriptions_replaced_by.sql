-- 升級訂閱時,新 sub 記錄它取代了哪個舊 sub。
-- 用途:ECPay return webhook 收到新 sub 付款成功後,自動退舊 sub 未用部分的 prorate 金額。

alter table public.subscriptions
  add column if not exists replaced_subscription_id uuid references public.subscriptions(id);

create index if not exists subscriptions_replaced_subscription_id_idx
  on public.subscriptions (replaced_subscription_id)
  where replaced_subscription_id is not null;
