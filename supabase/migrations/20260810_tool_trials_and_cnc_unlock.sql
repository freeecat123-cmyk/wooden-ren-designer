-- =============================================================================
-- 1. tool_trials：工具的免費試用紀錄（CNC 刀路產生器先用，其他工具沿用同一張表）
-- 2. 順手補上 tool_unlocks 漏掉的 'cnc'（現況是收得到錢、寫不進解鎖）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. tool_trials
-- -----------------------------------------------------------------------------
-- 一個帳號一個工具只能試用一次 → unique (user_id, tool)。
--
-- ⭐到期的列**不刪**：那一列本身就是「這個帳號試用過了」的證據。刪掉等於讓人
--   無限續試用，而試用期間拿得到完整工具，等於產品免費送。
--
-- ⭐expires_at 直接存下來，而不是每次拿 started_at + 7 天現算：
--   之後若辦活動送 14 天、或客服要個案延長，改的只是寫入當下那一筆，
--   既有試用不會被回溯改動（現算的話改天數會讓所有舊試用一起變長）。

create table if not exists public.tool_trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null check (tool in ('ceiling', 'floor', 'raised-floor', 'cnc')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (user_id, tool)
);

create index if not exists tool_trials_user_idx
  on public.tool_trials (user_id);

alter table public.tool_trials enable row level security;

-- 只給讀自己的。寫入一律走 service_role（/api/trial/start）——
-- 若開放 client insert，試用到期的人可以自己再 insert 一列重開試用。
create policy "user reads own tool trials"
  on public.tool_trials
  for select
  using (auth.uid() = user_id);

comment on table public.tool_trials is
  '工具免費試用紀錄:一個帳號一個工具一次。到期列保留當作「用過了」的證據,不得刪除';

-- -----------------------------------------------------------------------------
-- 2. tool_unlocks 補 'cnc'
-- -----------------------------------------------------------------------------
-- 🔴 這是線上進行中的缺陷,不是新功能:
--    lib/pricing/tool-unlock.ts 早已把 cnc 列進 VALID_TOOL_IDS 並定價 NT$499,
--    /api/checkout/tool 會照收、綠界會照扣款,但 /api/ecpay/return 回寫
--    tool_unlocks 時撞 check constraint（只允許 ceiling/floor/raised-floor）,
--    insert 失敗只被 console.error 吞掉 → **付了錢拿不到工具,且畫面沒有任何錯誤**。
--    查過線上資料:tool_unlocks 僅 1 筆 ceiling,payments 無任何 tool=cnc,
--    所以目前沒有受害者——但試用制上線後第一個買的人就會踩到。

alter table public.tool_unlocks
  drop constraint if exists tool_unlocks_tool_check;

alter table public.tool_unlocks
  add constraint tool_unlocks_tool_check
  check (tool in ('ceiling', 'floor', 'raised-floor', 'cnc'));
