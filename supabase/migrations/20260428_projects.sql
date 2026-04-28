-- =============================================================================
-- projects + project_items：把多個 design 打包成「一個案子」
-- =============================================================================
-- 裝潢設計師對自己客戶提案的單位是「案子」（玄關＋餐桌＋餐椅×6＋電視櫃...），
-- 不是單張家具報價。projects 是案子層級資料（客戶名/案場地址/設計概念），
-- project_items 是案子下的家具項目，透過 design_id 連到 designs，但同時 snapshot
-- furniture_type/params 一份，這樣即便來源 design 被刪也能繼續顯示與報價。
-- =============================================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,                         -- 案名，例如「林宅全屋」
  customer_name text,                          -- 客戶名稱
  customer_contact text,                       -- 客戶聯絡方式（電話 / Email / Line）
  project_address text,                        -- 案場地址
  design_concept text,                         -- 一句話設計概念（封面用）
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'confirmed', 'in_production', 'delivered', 'cancelled')),
  deposit_rate numeric(4,3) not null default 0.5
    check (deposit_rate >= 0 and deposit_rate <= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at
  before update on public.projects
  for each row execute function public.tg_set_updated_at();

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- project_items：案子下的家具項目（snapshot from designs）
-- -----------------------------------------------------------------------------
create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  design_id uuid references public.designs(id) on delete set null,
  furniture_type text not null,                -- snapshot
  name text not null,                          -- 顯示用
  params jsonb not null,                       -- snapshot of design.params
  quantity int not null default 1 check (quantity > 0),
  unit_price_override numeric(12, 2),          -- null = 用算出來的價；數字 = 議價後對外單價
  room text,                                    -- 「玄關 / 客廳 / 餐廳 / 主臥 / 次臥 ...」分組顯示用
  sort_order int not null default 0,
  notes text,                                   -- 備註（材質升級 / 客製要求 ...）
  created_at timestamptz not null default now()
);

create index if not exists project_items_project_idx on public.project_items (project_id);
create index if not exists project_items_project_sort_idx
  on public.project_items (project_id, sort_order);

alter table public.project_items enable row level security;

-- RLS 透過 join 到 projects 再判斷使用者；避免在 items 上直接存 user_id 造成資料漂移
drop policy if exists "project_items_select_own" on public.project_items;
create policy "project_items_select_own"
  on public.project_items for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_items.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "project_items_insert_own" on public.project_items;
create policy "project_items_insert_own"
  on public.project_items for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_items.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "project_items_update_own" on public.project_items;
create policy "project_items_update_own"
  on public.project_items for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_items.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "project_items_delete_own" on public.project_items;
create policy "project_items_delete_own"
  on public.project_items for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_items.project_id and p.user_id = auth.uid()
    )
  );
