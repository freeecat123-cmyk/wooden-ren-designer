-- 為 subscriptions 加 coupon_code 欄位
-- 記錄這次訂閱用了哪張 survey_coupons,webhook 確認付款後標 used。
-- nullable:沒用 coupon 的訂閱不寫。
alter table public.subscriptions
  add column if not exists coupon_code text;

create index if not exists subscriptions_coupon_code_idx
  on public.subscriptions (coupon_code)
  where coupon_code is not null;

comment on column public.subscriptions.coupon_code is
  '結帳時套用的 survey_coupons.code,webhook 付款成功後標 used';
