-- =============================================================================
-- #1 user_branding 表：報價單抬頭 / LOGO / 條款跨裝置同步
-- =============================================================================
-- 之前全存在 localStorage，跨裝置/瀏覽器登入會遺失。
-- 改存 Supabase 後跟 user_id 綁，登入後自動載入。localStorage 仍保留作為
-- 未登入或 offline 的 fallback（client 啟動時先用 local 顯示，遠端到了再覆寫）。
-- =============================================================================

create table if not exists public.user_branding (
  user_id uuid primary key references public.users(id) on delete cascade,
  data jsonb not null,                       -- BrandingData 整包
  updated_at timestamptz not null default now()
);

create index if not exists user_branding_updated_idx
  on public.user_branding (updated_at desc);

drop trigger if exists set_updated_at on public.user_branding;
create trigger set_updated_at
  before update on public.user_branding
  for each row execute function public.tg_set_updated_at();

alter table public.user_branding enable row level security;

drop policy if exists "user_branding_select_own" on public.user_branding;
create policy "user_branding_select_own"
  on public.user_branding for select
  using (auth.uid() = user_id);

drop policy if exists "user_branding_insert_own" on public.user_branding;
create policy "user_branding_insert_own"
  on public.user_branding for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_branding_update_own" on public.user_branding;
create policy "user_branding_update_own"
  on public.user_branding for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_branding_delete_own" on public.user_branding;
create policy "user_branding_delete_own"
  on public.user_branding for delete
  using (auth.uid() = user_id);
