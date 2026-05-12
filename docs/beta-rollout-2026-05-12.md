# 學生 Beta 開放測試包 · 2026-05-12

涵蓋：FB/IG 招募文案、Supabase Auth 完整教學、beta 用戶送半年 Pro 的設定 SOP。

---

## A. FB / IG 招募文案

### A1. FB 社團貼文（木匠學院社團）

```
【內測招募 · 木頭仁工程圖生成器 v1.0】

從凌晨四點到天亮，第 N 次盯著螢幕想到底「畫一張木工圖」
要怎麼讓木工新手 5 分鐘就學會。

家具設計生成器終於做出來了。

選家具、輸入尺寸、選木材、按下按鈕——
✦ 3D 立體模型
✦ 工程三視圖（含尺寸標註）
✦ 榫卯細節分解圖
✦ 完整材料清單（含台才/才數計算）
✦ A4 列印工程圖紙

全部自動產出。連報價單都能直接給客戶。

目前開放 100 位「木匠學院內測夥伴」優先試用——
💎 即日起到 11/12，半年期間 完整解鎖專業版功能
💎 你的回報、建議我會親自看、親自改

申請方式：留言「+1」、私訊我 Email，我會把你加進名單。
網址：https://wooden-ren-designer.vercel.app

——木頭仁
```

### A2. IG 貼文（搭配生成器螢幕截圖）

```
🛠️ 內測招募｜木頭仁工程圖生成器

選尺寸 → 選木材 → 一鍵產 3D + 工程圖 + 材料單
連報價單都自動算給客戶看。

100 位內測名額，半年免費解鎖專業版。
留言「+1」，限木匠學院夥伴。

—
@woodenren｜https://wooden-ren-designer.vercel.app
#木工 #榫卯 #木匠學院 #工程圖
```

### A3. IG Stories（3 連投）

```
[01] 「畫一張木工圖要花多少時間？」
     圖：手工 SketchUp 截圖

[02] 「現在 5 分鐘自動產 3D + 三視圖 + 材料單。」
     圖：生成器產出 GIF / 螢幕錄影

[03] 「100 位內測名額。半年免費解鎖專業版。」
     CTA：⬆️ Swipe Up
```

### A4. YouTube 社群貼文（短）

```
🚧 內測招募｜家具設計生成器
選尺寸 → 自動產 3D + 工程圖 + 材料單
👉 https://wooden-ren-designer.vercel.app
留言「+1」+ Email，半年免費試用專業版（100 位）
```

---

## B. Supabase Auth 設定教學

> 目標：學生可用 Google 帳號或 Email magic link 登入。

### B1. 前情提要 — 你的程式已經做了什麼

1. **client SDK**：`lib/supabase/client.ts` 已建立。
2. **server SDK**：`lib/supabase/server.ts` 帶 cookie，SSR 能讀到登入狀態。
3. **AuthProvider**：`components/auth/AuthProvider.tsx`，全站登入狀態。
4. **Header 登入小工具**：`components/auth/HeaderUser.tsx`，全站右上角浮動按鈕。
5. **新人 trigger**：每次有人首次登入，DB trigger `handle_new_user()` 自動建一筆 `public.users` row。
6. **白名單機制**：`public.whitelist` 表內若有此 email，trigger 直接把 `plan` 設成 `student`。

所以你「不需要寫程式」，只要在 Supabase Dashboard 開好登入方式 + 把 beta 學員 email 倒進 whitelist。

---

### B2. Step 1 — 開啟 Email Magic Link（10 分鐘最快路徑）

1. 登入 Supabase Dashboard → 你的專案。
2. 左側選 `Authentication` → `Providers`。
3. `Email` 預設就是開的；點進去確認：
   - **Enable Email provider**：✅
   - **Confirm email**：建議 ✅（學員首次必須點 email 內連結驗證）
   - **Secure email change**：✅
4. 左側選 `Authentication` → `URL Configuration`：
   - **Site URL**：填 `https://wooden-ren-designer.vercel.app`（之後綁正式網域再改）
   - **Redirect URLs** 加入：
     - `https://wooden-ren-designer.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`（本地開發用）
5. 左側選 `Authentication` → `Email Templates`：
   - 點 `Magic Link` 範本 → 改成中文：
     ```
     主旨：登入 木頭仁工程圖生成器
     內文：
       哈囉！你正在登入木頭仁工程圖生成器。
       請點下方連結完成登入（10 分鐘內有效）：
       {{ .ConfirmationURL }}
       
       如果不是你本人，忽略這封信即可。
       —— 木頭仁木匠學院
     ```
   - 同樣改 `Confirm signup` 範本

✅ 完成這 5 步，學員到 `/auth/login` 輸入 email 就會收到登入連結。

---

### B3. Step 2 — 加上 Google OAuth（建議，免打字最方便）

1. 先去 **Google Cloud Console**：
   - 進 https://console.cloud.google.com/
   - 建一個專案叫 `wooden-ren-designer`
   - 左側 `API 和服務` → `OAuth 同意畫面`：
     - User Type 選「External」
     - 應用程式名稱：`木頭仁工程圖生成器`
     - 使用者支援電子郵件：`wengbinren@gmail.com`
     - 開發人員聯絡資訊：`wengbinren@gmail.com`
     - 範圍只勾 email + profile + openid
   - 左側 `API 和服務` → `憑證` → 建立憑證 → `OAuth 用戶端 ID`：
     - 類型：「網頁應用程式」
     - 已授權的重新導向 URI 加 `https://<你的-supabase-project>.supabase.co/auth/v1/callback`
     - 拿到 **Client ID** 跟 **Client Secret**（複製下來）

2. 回 **Supabase Dashboard**：
   - `Authentication` → `Providers` → `Google`
   - **Enable**：✅
   - 貼上剛剛的 Client ID、Client Secret
   - 按儲存

3. 程式裡呼叫（已經寫好，不用動）：`supabase.auth.signInWithOAuth({ provider: 'google' })`

✅ 學員按下「使用 Google 登入」一鍵完成。

---

### B4. Step 3 — 把 beta 學員 Email 倒進 whitelist

兩種方式擇一：

**方式 A（推薦）：用 Admin 後台 CSV 上傳**

1. 用木頭仁 admin email 登入（`wengbinren@gmail.com` 已是 admin）
2. 開 `/admin/whitelist`
3. 準備一份 CSV，欄位 `email,name,source,note`：
   ```csv
   email,name,source,note
   ming@example.com,小明,manual,2026-05-beta-第一批
   lin@example.com,林大,manual,2026-05-beta-第一批
   ```
4. 拖進 CSV 上傳區塊 → 預覽 → 確認匯入

**方式 B：Supabase SQL 直接塞**

到 Supabase Dashboard → `SQL Editor`：
```sql
insert into public.whitelist (email, source, note) values
  ('ming@example.com', 'manual', '2026-05-beta'),
  ('lin@example.com', 'manual', '2026-05-beta');
```

之後這些 email 任何時候註冊，都會自動拿到 `student` 方案。

---

## C. Beta 學員「送半年 Pro」設定 SOP

### 現況

- whitelist trigger 預設給的是 `student` 方案。
- `student` 方案在 `lib/permissions.ts` 中**功能與 pro 完全相同**（可下載 PDF、報價系統、客戶管理、設計師模式、無浮水印）。
- 預設 `student_expires_at = 註冊時間 + 2 年`。

### 你的需求：beta 只送半年（6 個月）

最簡單的方式：**讓他們先正常註冊（拿到 2 年 student），然後 SQL 一行把 2 年改成 6 個月**。

在 Supabase SQL Editor 跑一次：

```sql
-- 把所有 note 含「2026-05-beta」的 whitelist email 對應的 user
-- 的 student_expires_at 改成 註冊時間 + 6 個月
update public.users u
set student_expires_at = u.created_at + interval '6 months'
where u.email in (
  select email from public.whitelist where note like '%2026-05-beta%'
)
  and u.plan = 'student';

-- 驗證
select email, plan, student_activated_at, student_expires_at
from public.users
where email in (
  select email from public.whitelist where note like '%2026-05-beta%'
);
```

> 流程：每次新增一批 beta，CSV 的 `note` 欄都填 `2026-05-beta`（或下一輪的代號），
> 然後跑上面這段 SQL 把他們縮成 6 個月。**已過期者不會被「縮短到過去」**（因為 `now()` 早於 6 個月前的 created_at 才會被縮）。

### 簡化版（一個人手動加）

如果只是測試先加 1~2 個自己人：

```sql
insert into public.whitelist (email, source, note)
values ('test@example.com', 'manual', 'internal');

-- 等對方註冊完之後
update public.users
set student_expires_at = now() + interval '6 months'
where email = 'test@example.com';
```

---

## D. 開放前最後檢查清單

- [ ] B2 Email Magic Link 設好、寄信驗證
- [ ] B3 Google OAuth 設好（不急可後補，先用 Magic Link）
- [ ] `app/auth/callback/route.ts` 存在（已存在，不用動）
- [ ] Vercel 環境變數 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 已設
- [ ] `/terms` 與 `/privacy` 頁面可開（剛剛已建）
- [ ] footer 的「服務條款 / 隱私權政策」連結點得到
- [ ] 隨便註冊一個測試帳號驗證：登入 → 看得到 footer → 看得到右下角 🐛 → free 方案只能進 stool/tea-table/pencil-holder
- [ ] beta 名單 CSV 上傳 → 第一個 beta 學員登入 → admin 後台看到他 `plan=student`
- [ ] 跑 C 段 SQL → 學員看到「學員方案剩餘 X 天」橫幅

build at HEAD · 2026-05-12 Taipei
