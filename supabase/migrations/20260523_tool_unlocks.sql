-- tool_unlocks：天花板 / 地板 工具的單次買斷紀錄
-- 跟 template_unlocks 分開:範本是「家具」、工具是「裝潢估料」,概念分明
-- 兩個工具:ceiling、floor
-- canUseCeilingTool / canUseFloorTool 之後查 plan OR tool_unlocks 任一通過放行

create table if not exists public.tool_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null check (tool in ('ceiling', 'floor')),
  paid_amount int not null,
  ecpay_merchant_trade_no text,
  created_at timestamptz not null default now(),
  unique (user_id, tool)
);

create index if not exists tool_unlocks_user_idx
  on public.tool_unlocks (user_id);

alter table public.tool_unlocks enable row level security;

create policy "user reads own tool unlocks"
  on public.tool_unlocks
  for select
  using (auth.uid() = user_id);

comment on table public.tool_unlocks is
  '工具單次買斷:ceiling / floor。canUseCeilingTool/FloorTool 查 plan OR 這張表';
