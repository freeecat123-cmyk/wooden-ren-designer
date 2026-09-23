-- 2026-05-19: subscriptions 加 period 欄位
--
-- 為什麼：ecpay/return webhook 原本用「綠界回呼有沒有 PeriodType 欄位」
-- 來判斷該給 31 天還是 365 天。這在「綠界沒開通定期定額」或「定期定額申請失敗」
-- 時會出大事 — 使用者選月付、扣 390 一次、卻拿到 365 天訪問權，平台直接虧爆。
--
-- 修法：checkout 寫 subscription 時就把使用者選的 period 存起來，
-- webhook 一律以 sub.period 為準；如果是 monthly 但綠界回呼沒帶 PeriodType
-- → 視為定期定額建立失敗，標 expired 並要求退款。

alter table public.subscriptions
  add column if not exists period text check (period in ('monthly', 'yearly'));

comment on column public.subscriptions.period is
  'checkout 時使用者選的計費週期：monthly 走信用卡定期定額、yearly 走一次性付款。webhook 必須以這個為準，不可從綠界回呼欄位反推。';
