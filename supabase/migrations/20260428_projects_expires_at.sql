-- 報價有效期：預設建專案後 14 天，師傅可手動延期
-- 過期後客戶端 quote 頁顯示紅色「已過期」橫幅，師傅端顯示倒數
alter table public.projects
  add column if not exists expires_at timestamptz;

-- 既有 row 沒值 → 補成 created_at + 14 天
update public.projects
set expires_at = created_at + interval '14 days'
where expires_at is null;

-- 之後新建 row 沒帶 expires_at 也自動 +14 天（trigger）
create or replace function public.tg_set_project_expires_at()
returns trigger
language plpgsql
as $$
begin
  if new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now()) + interval '14 days';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_project_expires_at on public.projects;
create trigger trg_set_project_expires_at
  before insert on public.projects
  for each row execute function public.tg_set_project_expires_at();

comment on column public.projects.expires_at is
  '報價有效期；過期後客戶端 quote 頁顯示「已過期」橫幅，但連結仍可看（不刪資料）。';
