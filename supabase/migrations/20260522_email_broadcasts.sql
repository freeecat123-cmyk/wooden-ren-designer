-- email_broadcasts：admin 批次寄信紀錄。
-- 用途：
--   1. 開賣後對未付費註冊者寄問卷 / 折扣 coupon
--   2. 對已付費者寄感謝 / 新功能通知 / NPS 調查
--   3. 留紀錄避免重複寄、追蹤每批寄了什麼
--
-- 不是 queue（44 人量級不需要 cron 慢慢吃）—— server action 同步寄完、
-- 結果直接寫進這張表，UI 看 sent/failed count 知道成敗。
-- 失敗的單封還是會進既有 email_queue（lib/email/send.ts 的 fallback）。

create table if not exists public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  -- 寄送對象描述（給 admin UI 看，不影響邏輯）
  -- e.g. "未付費 (44 人)" / "已付費 個人版 (12 人)" / "手動 5 emails"
  audience_label text not null,
  -- audience filter 原始 spec（之後想 re-run 或審計用）
  -- { kind: "unpaid" | "paid" | "plan" | "manual" | "all", plan?: string, emails?: string[] }
  audience_filter jsonb not null,
  -- 寄出當下抓到的人數（filter 後實際的 recipients 數）
  recipient_count int not null,
  subject text not null,
  text_body text not null,
  html_body text not null,
  -- 寄送統計
  sent_count int not null default 0,
  failed_count int not null default 0,
  -- 哪個 admin 寄的
  created_by_email text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists email_broadcasts_created_idx
  on public.email_broadcasts (created_at desc);

-- RLS：admin 用 service role 寫（自動 bypass）、一般用戶完全擋（沒 policy = 全拒絕）。
-- API route 端會檢查 isAdminEmail，這層是第二道防線。
alter table public.email_broadcasts enable row level security;

comment on table public.email_broadcasts is
  'admin 批次寄信紀錄：每次 broadcast 留一筆，含 audience filter / sent / failed';
