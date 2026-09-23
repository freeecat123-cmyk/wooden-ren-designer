-- =============================================================================
-- refund_requests 退費申請表
--
-- user 在 /refund 頁送出申請、admin 在 /admin/refunds 審核。
-- 一筆 user 可送多筆（不同訂閱期）；同一 payment 不能重複申請（unique）。
-- =============================================================================

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  amount_requested integer not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'refunded')),
  admin_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 同 payment 不能重複申請（除非前次 rejected）
create unique index if not exists refund_requests_payment_active_uniq
  on public.refund_requests (payment_id)
  where status in ('pending', 'approved', 'refunded');

create index if not exists refund_requests_user_id_idx
  on public.refund_requests (user_id);
create index if not exists refund_requests_status_idx
  on public.refund_requests (status);

-- updated_at trigger
create or replace function refund_requests_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists refund_requests_updated_at on public.refund_requests;
create trigger refund_requests_updated_at
  before update on public.refund_requests
  for each row execute function refund_requests_set_updated_at();

-- RLS：user 只能讀寫自己的；admin 走 service_role 繞過
alter table public.refund_requests enable row level security;

create policy "refund_requests_select_own" on public.refund_requests
  for select using (auth.uid() = user_id);

create policy "refund_requests_insert_own" on public.refund_requests
  for insert with check (auth.uid() = user_id);

-- user 不能 update 自己的 request（status 由 admin 改）
-- admin 用 service_role 繞 RLS、不需 policy

comment on table public.refund_requests is
  '使用者退費申請。pending→approved/rejected→refunded(實際打 ECPay refund API 或手動退完)';
