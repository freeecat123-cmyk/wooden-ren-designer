-- =============================================================================
-- 修正 designs_insert_own：免費版限「類別」白名單，不是「件數」<3
--
-- 原 policy：免費 user 可存 3 件「任何類別」（含 wardrobe / dining-table 等付費類）。
-- 跟 lib/permissions.ts FREE_UNLOCKED_CATEGORIES 完全不對齊。
-- 攻擊者在 /design/stool 開 DevTools 直接 insert {furniture_type:'wardrobe',...} → 通過 RLS。
--
-- 新 policy：免費 user 只能存 FREE_UNLOCKED_CATEGORIES（'stool','tea-table','pencil-holder'）、
-- 件數不限；付費 user 全部解鎖（透過 auth_has_active_paid_plan()）。
-- =============================================================================

drop policy if exists "designs_insert_own" on public.designs;
create policy "designs_insert_own" on public.designs for insert
  with check (
    auth.uid() = user_id
    and (
      auth_has_active_paid_plan()
      or furniture_type in ('stool', 'tea-table', 'pencil-holder')
    )
  );

comment on policy "designs_insert_own" on public.designs is
  '免費版限三種入門類別（stool/tea-table/pencil-holder），件數不限；付費版全開。對齊 lib/permissions.ts FREE_UNLOCKED_CATEGORIES。';
