-- =============================================================================
-- tool_unlocks 加 'raised-floor' 進 CHECK constraint
--
-- 原 constraint：check (tool in ('ceiling', 'floor'))
-- 改為：       check (tool in ('ceiling', 'floor', 'raised-floor'))
--
-- 動機：和室架高平台 (/raised-floor) 之前只能訂閱使用，加進單買名單後
-- 國際版 (Lemon Squeezy) + 台灣版 (ECPay) 都能單買 NT$599 / $14.99 (studio)。
-- =============================================================================

alter table public.tool_unlocks
  drop constraint if exists tool_unlocks_tool_check;

alter table public.tool_unlocks
  add constraint tool_unlocks_tool_check
  check (tool in ('ceiling', 'floor', 'raised-floor'));
