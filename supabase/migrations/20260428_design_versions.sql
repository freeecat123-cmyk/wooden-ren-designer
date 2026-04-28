-- =============================================================================
-- #10 設計方案版本化：design 修改不再覆寫，自動建版本
-- =============================================================================
-- designs 仍是「最新版本」的 cache（前端讀寫快）；design_versions 保留每次更新前的快照。
-- 觸發：每次 update designs 時 trigger 自動把舊 row 寫入 design_versions。
-- =============================================================================

create table if not exists public.design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  furniture_type text not null,
  name text,
  params jsonb not null,
  created_at timestamptz not null default now(),
  -- 觸發版本的事件（更新前快照 / 使用者手動標記）
  reason text not null default 'auto'
    check (reason in ('auto', 'manual', 'restore'))
);

create index if not exists design_versions_design_idx
  on public.design_versions (design_id, created_at desc);
create index if not exists design_versions_user_idx
  on public.design_versions (user_id, created_at desc);

-- 觸發器：update designs 前先把舊 row 寫入 design_versions
create or replace function public.tg_designs_snapshot_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 只在實際變更 params 或 name 時建版本，避免 updated_at trigger 自我觸發後還產生空版本
  if old.params is distinct from new.params or coalesce(old.name, '') is distinct from coalesce(new.name, '') then
    insert into public.design_versions (
      design_id, user_id, furniture_type, name, params, reason
    ) values (
      old.id, old.user_id, old.furniture_type, old.name, old.params, 'auto'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_before_update on public.designs;
create trigger snapshot_before_update
  before update on public.designs
  for each row execute function public.tg_designs_snapshot_version();

alter table public.design_versions enable row level security;

drop policy if exists "design_versions_select_own" on public.design_versions;
create policy "design_versions_select_own"
  on public.design_versions for select
  using (auth.uid() = user_id);

-- 不開放 insert / update / delete 給 client：版本由 trigger 自動建
-- 「恢復某版本」由 client 改寫 designs.params（會觸發新 auto snapshot）
