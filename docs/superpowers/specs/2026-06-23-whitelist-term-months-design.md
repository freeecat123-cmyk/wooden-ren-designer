# 白名單可選開通年限（半年 / 1 年 / 2 年）

日期：2026-06-23
情境：要把「舊木匠學院會員」用較短的半年期開通，跟一般白名單（1 年）區分開。

## 背景（現況）

白名單 email 一律開通 `pro` 方案、`subscription_expires_at = 註冊日 + 1 年`，
兩條路徑行為一致：

1. **註冊 trigger** `handle_new_user`（`20260611_whitelist_auto_pro_1year.sql`）——
   尚未註冊的 email 之後用該 email 註冊時自動開通。
2. **POST `/api/admin/whitelist`** —— 已註冊但 `plan='free'` 的同 email 即時升級。

年限目前寫死 `1 year`，`source` 欄位只是標籤，不影響年限。

## 目標

讓白名單**每筆**可帶開通月數（`term_months`），預設 12（= 維持現況 1 年），
舊木匠學院會員設 6（半年）。單筆與 CSV 批量都能選年限。

## 設計

### 1. DB：`whitelist` 加 `term_months`

```sql
alter table public.whitelist
  add column if not exists term_months int not null default 12;
```

- 既有 row 自動補 12 → 不改變任何現有行為與現有學員。
- 合法值：6 / 12 / 24（UI 限定；DB 不硬性 check 以保彈性）。

### 2. 重寫 trigger `handle_new_user`

從 `exists` 判斷改成 select 出該 email 的 `term_months`，到期日用月數計算：

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_term int;
  v_hit boolean := false;
begin
  select coalesce(term_months, 12) into v_term
  from public.whitelist
  where lower(email) = lower(new.email)
  limit 1;
  v_hit := found;

  insert into public.users (id, email, name, plan, subscription_status, subscription_expires_at)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    case when v_hit then 'pro' else 'free' end,
    case when v_hit then 'active' else 'inactive' end,
    case when v_hit then now() + (v_term || ' months')::interval else null end
  )
  on conflict (id) do nothing;
  return new;
end; $$;
```

trigger 重綁（drop + create，與既有 migration 一致）。

### 3. POST API 收 `termMonths`

`app/api/admin/whitelist/route.ts`：

- `PostBody` 加 `termMonths?: number`；rows 也可帶 `term_months`。
- clamp / 白名單合法值（6/12/24），非法 fallback 12。
- 寫進 whitelist record 的 `term_months`。
- 即時升級 free→pro 的到期日改用 `now() + termMonths 個月`（取代寫死 +1 年）。
  通知信 `proAccessEmail({ expiresAt })` 已吃日期，自動正確。
- 同一批多種年限：單筆用單一 `termMonths`；CSV 整批套同一個 `termMonths`
  （UI 的年限下拉同時管單筆與 CSV）。

### 4. 表單 UI：加「開通年限」下拉

`components/admin/WhitelistAdminClient.tsx`：

- 新增 state `newTermMonths`（預設 12）。
- 在新增區塊上方放一個共用下拉：半年（6）／1 年（12，預設）／2 年（24）。
- 單筆 POST 與 CSV import 的 body 都帶 `termMonths: newTermMonths`。

### 5. 列表顯示「年限」與「到期日」

使用者回報：目前白名單列表看不到年限與到期日。

- **年限**：讀該 row 的 `term_months` → 顯示「半年 / 1 年 / 2 年」（或 `N 個月`）。永遠有。
- **到期日**：`subscription_expires_at` 在 `users` 表、只有**註冊後**才存在。
  - GET `/api/admin/whitelist` 多查一次 `users`（用 whitelist 的 email 清單 `in`），
    回傳 `{ ...whitelistRow, subscription_expires_at, plan }` 合併。
  - 列表新增「到期日」欄：已註冊顯示日期、未註冊顯示「未註冊」。

## 範圍外（不動）

- 現有已開通的 user（學員 / pro）——只影響「以後新增 / 新註冊」的白名單。
- `student` legacy plan 與 `student_expires_at` 欄位。
- 批次延長到期日工具（`extend-students`）。

## 驗證

1. `npx tsc --noEmit` 0 新錯。
2. SQL migration 在 Supabase SQL Editor 跑完，`term_months` 欄存在、既有 row = 12。
3. 後台白名單：選「半年」加一筆測試 email → record `term_months=6`，列表顯示半年。
4. 用該 email 註冊 → `users.subscription_expires_at` 約 6 個月後。
5. 既有 free user 用半年加白名單 → 即時升 pro、到期日約 6 個月後、通知信日期正確。
6. 不選年限直接加 → 預設 12、到期日約 1 年後（迴歸現況）。
7. 列表：每筆顯示年限欄；已註冊者顯示到期日、未註冊者顯示「未註冊」。
