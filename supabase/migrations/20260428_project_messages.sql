-- 客戶 ↔ 師傅留言 thread
-- 客戶（無帳號）走 share_token 經 admin client 插入；師傅走 RLS 正常讀寫
create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'craftsman')),
  sender_name text,
  content text not null check (length(content) > 0 and length(content) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists project_messages_project_idx
  on public.project_messages(project_id, created_at);

alter table public.project_messages enable row level security;

-- 師傅（專案擁有者）能讀自己案子的所有訊息
drop policy if exists "owner_read_messages" on public.project_messages;
create policy "owner_read_messages" on public.project_messages
  for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- 師傅能在自己案子裡發訊息
drop policy if exists "owner_insert_messages" on public.project_messages;
create policy "owner_insert_messages" on public.project_messages
  for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
    and sender_role = 'craftsman'
  );

-- 客戶端不直接走 SQL；走 API route 用 admin client 插入（驗證 share_token 後）
comment on table public.project_messages is
  '客戶與師傅的留言 thread。客戶端寫入由 /api/projects/[id]/messages 用 admin client 處理。';
