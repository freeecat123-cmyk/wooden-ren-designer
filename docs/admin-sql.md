# Admin 速查 SQL

客服 / 故障排查常用查詢。所有都在 Supabase Dashboard → SQL Editor 跑（service_role 已預設，繞 RLS）。

把 `'xxx@example.com'` / `'xxx-uuid'` 換成實際值。

---

## 1. 查某用戶完整狀態

```sql
-- 一個 user 的訂閱 + 付款 + 發票 全景
select
  u.email,
  u.plan,
  u.subscription_status,
  u.subscription_expires_at,
  u.student_expires_at,
  u.welcome_email_sent_at,
  u.invoice_preference
from public.users u
where u.email = 'xxx@example.com';
```

```sql
-- 該 user 所有付款紀錄（最新在上）
select
  p.created_at,
  p.amount,
  p.status,
  p.invoice_status,
  p.invoice_number,
  p.ecpay_trade_no,
  p.invoice_error_message
from public.payments p
join public.users u on u.id = p.user_id
where u.email = 'xxx@example.com'
order by p.created_at desc;
```

```sql
-- 該 user 訂閱列（含已取消 / 過期）
select
  s.created_at,
  s.plan,
  s.period,
  s.status,
  s.started_at,
  s.expires_at,
  s.ecpay_merchant_trade_no,
  s.ecpay_periodic_no,
  s.replaced_subscription_id
from public.subscriptions s
join public.users u on u.id = s.user_id
where u.email = 'xxx@example.com'
order by s.created_at desc;
```

---

## 2. 「我刷完沒解鎖」診斷

```sql
-- 該 user 的最新 subscription + 最新 payment 對照
with target as (
  select id from public.users where email = 'xxx@example.com'
)
select
  s.id as sub_id, s.status as sub_status, s.expires_at,
  s.ecpay_merchant_trade_no,
  p.id as payment_id, p.status as payment_status,
  p.ecpay_trade_no, p.created_at as paid_at
from public.subscriptions s
left join public.payments p on p.subscription_id = s.id
where s.user_id = (select id from target)
order by s.created_at desc, p.created_at desc
limit 5;
```

判斷邏輯：
- payment 無 row → ECPay webhook 未到（5 分鐘內等等）
- payment.status=failed → 看 raw_response 找 RtnMsg
- payment.status=success 但 users.plan 沒變 → webhook 跑過但更新 users 那步失敗，手動補：

```sql
-- 手動補 plan + expires_at（從 subscription 抓正確值）
update public.users
set plan = (select plan from public.subscriptions where id = 'SUB-UUID'),
    subscription_status = 'active',
    subscription_expires_at = (select expires_at from public.subscriptions where id = 'SUB-UUID')
where id = (select user_id from public.subscriptions where id = 'SUB-UUID');
```

---

## 3. ECPay webhook raw 內容

```sql
-- 撈某筆付款的綠界原始回應（debug 用）
select raw_response
from public.payments
where ecpay_trade_no = '2025XXXXXXXX';
```

---

## 4. email_queue replay

```sql
-- 看待 replay 的失敗信
select id, to_email, subject, failure_kind, error, created_at
from public.email_queue
where status = 'failed'
order by created_at desc;
```

```sql
-- 看 quota 撞牆寄不出的（隔天 Resend 配額重置後可 replay）
select count(*), failure_kind
from public.email_queue
where status = 'failed'
group by failure_kind;
```

```sql
-- 標記已手動處理（含 status check 防呆）
update public.email_queue
set status = 'replayed_ok', replayed_at = now()
where id = 'EMAIL-UUID' and status = 'failed';
```

---

## 5. 發票相關

```sql
-- 找今天開立失敗的發票（要處理）
select p.id, u.email, p.amount, p.invoice_error_message, p.created_at
from public.payments p
join public.users u on u.id = p.user_id
where p.invoice_status = 'failed'
  and p.created_at >= now() - interval '1 day'
order by p.created_at desc;
```

```sql
-- 找已開立但收件人 email 沒收到（檢查 email_queue 對照）
select p.invoice_number, u.email, p.invoice_issued_at
from public.payments p
join public.users u on u.id = p.user_id
where p.invoice_status = 'issued'
  and p.invoice_issued_at >= now() - interval '7 days'
order by p.invoice_issued_at desc;
```

```sql
-- 查近 30 天所有折讓單（跨 24h 退費走這條）
select u.email, p.invoice_number, p.allowance_number,
       p.allowance_amount, p.allowance_issued_at
from public.payments p
join public.users u on u.id = p.user_id
where p.invoice_status = 'allowanced'
  and p.allowance_issued_at >= now() - interval '30 days'
order by p.allowance_issued_at desc;
```

```sql
-- 找作廢 / 折讓都失敗的退款（人工處理 queue）
select u.email, p.invoice_number, p.invoice_status, p.invoice_issued_at,
       p.status as payment_status, p.created_at
from public.payments p
join public.users u on u.id = p.user_id
where p.status = 'refunded'
  and p.invoice_status not in ('invalid', 'allowanced')
  and p.invoice_number is not null
order by p.created_at desc;
```

---

## 6. 退費追蹤

```sql
-- 待審核的退費申請
select r.id, u.email, r.amount, r.reason, r.status, r.created_at
from public.refund_requests r
join public.users u on u.id = r.user_id
where r.status = 'pending'
order by r.created_at;
```

```sql
-- 最近 30 天已退款的紀錄
select u.email, p.amount, p.created_at, p.ecpay_trade_no
from public.payments p
join public.users u on u.id = p.user_id
where p.status = 'refunded'
  and p.created_at >= now() - interval '30 days'
order by p.created_at desc;
```

---

## 7. 日報 / 商業指標

```sql
-- 今天新註冊
select count(*) as new_users
from public.users
where created_at >= current_date;
```

```sql
-- 今天成功付款數 + 金額
select count(*) as orders, sum(amount) as revenue
from public.payments
where status = 'success'
  and created_at >= current_date;
```

```sql
-- 目前 active 訂閱（按 plan + period 拆）
select plan, period, count(*) as count
from public.subscriptions
where status = 'active'
group by plan, period
order by plan, period;
```

```sql
-- 月扣 active 用戶（會自動續扣的）— 預估下個月 MRR
select count(*) as monthly_active,
       sum(expected_amount) as projected_next_month
from public.subscriptions
where status = 'active'
  and period = 'monthly'
  and ecpay_periodic_no is not null;
```

```sql
-- 近 7 天到期但沒續訂的（流失警示）
select u.email, s.plan, s.expires_at
from public.subscriptions s
join public.users u on u.id = s.user_id
where s.status = 'expired'
  and s.expires_at >= now() - interval '7 days'
order by s.expires_at desc;
```

---

## 8. 系統健康檢查

```sql
-- 找「孤兒 payment」：success 但對應 user.plan 沒解鎖（webhook 漏更新）
select p.id, u.email, p.amount, u.plan, p.created_at
from public.payments p
join public.users u on u.id = p.user_id
where p.status = 'success'
  and u.plan = 'free'
  and p.created_at >= now() - interval '7 days';
```

```sql
-- 找「孤兒 subscription」：active 但無對應 success payment
select s.id, u.email, s.plan, s.status
from public.subscriptions s
join public.users u on u.id = s.user_id
where s.status = 'active'
  and not exists (
    select 1 from public.payments p
    where p.subscription_id = s.id and p.status = 'success'
  );
```

```sql
-- 找雙 active 訂閱（同 user 兩個未 cancel 的）— 升降級流程出 bug 的指標
select user_id, count(*) as active_subs
from public.subscriptions
where status = 'active'
group by user_id
having count(*) > 1;
```

---

## 9. 緊急手動操作

```sql
-- 手動延長某 user 訂閱（客服補償用）
update public.users
set subscription_expires_at = subscription_expires_at + interval '7 days'
where email = 'xxx@example.com';
update public.subscriptions
set expires_at = expires_at + interval '7 days'
where user_id = (select id from public.users where email = 'xxx@example.com')
  and status = 'active';
```

```sql
-- 強制把 user downgrade 到 free（取消後不退款的情況）
update public.users
set plan = 'free',
    subscription_status = 'expired'
where email = 'xxx@example.com';
```

```sql
-- 把卡住的 pending refund 改成 approved（手動處理後補狀態）
update public.refund_requests
set status = 'approved', processed_at = now()
where id = 'REFUND-UUID';
```

---

## 操作守則

- ⚠️ 寫入操作前先 `select` 確認影響範圍
- ⚠️ `update` / `delete` 永遠帶 `where`，沒 `where` 直接取消重來
- ⚠️ 手動改 users.plan 後務必同步改 subscriptions（兩張表狀態要一致）
- ✅ Supabase Dashboard 有 Query History，跑過的 SQL 可從那邊找回
