-- 專案付款追蹤 + 預計完工日 + 內部備註
-- per drafting-math.md AE / AM 章節，使用者最痛的「金流追蹤」與「進度透明」

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deposit_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_date_override date,
  ADD COLUMN IF NOT EXISTS internal_notes text;

COMMENT ON COLUMN projects.deposit_received_at IS
  '訂金收款日期（null = 尚未收）';
COMMENT ON COLUMN projects.balance_received_at IS
  '尾款收款日期（null = 尚未收）';
COMMENT ON COLUMN projects.delivery_date_override IS
  '手動覆寫的預計完工日（null = 沿用 estimatedWorkdays 自動算）';
COMMENT ON COLUMN projects.internal_notes IS
  '內部備註（業主看不到，給設計師/木匠/工頭做筆記）';
