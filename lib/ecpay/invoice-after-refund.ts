/**
 * 退款後處理發票:< 24h 作廢、>= 24h 開折讓單。
 *
 * 統一這條邏輯避免四個 caller 各自實作分歧:
 *   - app/api/admin/refunds/[id]       標準 approve 流程
 *   - app/api/admin/refunds/quick      測試一鍵退費
 *   - app/api/admin/payments/[id]/void-invoice  歷史漏網手動補
 *   - app/api/ecpay/return upgrade   升級自動退舊版
 *
 * 為什麼必須處理:
 *   退款後發票沒作廢/折讓 → 財政部視為「開了發票卻沒收錢」=> 差額被當逃漏稅
 *   24h 內作廢:乾淨,綠界後台看不到原發票
 *   超過 24h:必須走折讓,發票留著、折讓單抵銷
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { allowanceInvoice, invalidInvoice } from "./invoice";

export interface VoidOrAllowanceInput {
  paymentId: string;
  invoiceNumber: string;
  invoiceIssuedAt: string; // ISO timestamptz
  /** 退款金額(部分退款時 < 原發票),折讓單 amount 用這個 */
  refundAmount: number;
  /** 用於折讓單品名(會印在折讓單上) */
  itemName?: string;
  /** 折讓通知 email(buyer 收到折讓通知);超過 24h 必填,缺值會 skip allowance */
  notifyEmail?: string;
  /** 公司戶才需填(折讓單抬頭) */
  customerName?: string;
  /** 24h 內 invalid 的 Reason 欄位 */
  invalidReason?: string;
}

export interface VoidOrAllowanceResult {
  mode: "voided" | "allowanced" | "skipped";
  ok: boolean;
  rtnCode?: number | string;
  rtnMsg?: string;
  allowanceNumber?: string;
  allowanceAmount?: number;
  ageHours: number;
  /** skipped 原因:no_email / both_failed / no_invoice 等 */
  skipReason?: string;
}

/**
 * 主流程。
 * - svc:service-role supabase client(payment DB 寫入要 bypass RLS)
 * - 失敗只回 result,不 throw;caller 看 result.ok 決定要不要 log 或回 422
 */
export async function voidOrAllowanceAfterRefund(
  svc: SupabaseClient,
  input: VoidOrAllowanceInput,
): Promise<VoidOrAllowanceResult> {
  const ageMs = Date.now() - new Date(input.invoiceIssuedAt).getTime();
  const ageHours = ageMs / 3_600_000;
  const within24h = ageMs < 24 * 60 * 60 * 1000;
  const invoiceDate = new Date(input.invoiceIssuedAt).toISOString().slice(0, 10);

  if (within24h) {
    const inv = await invalidInvoice({
      invoiceNumber: input.invoiceNumber,
      invoiceDate,
      reason: (input.invalidReason ?? "退款作廢").slice(0, 20),
    });
    if (inv.success) {
      await svc
        .from("payments")
        .update({ invoice_status: "invalid" })
        .eq("id", input.paymentId);
    }
    return {
      mode: "voided",
      ok: inv.success,
      rtnCode: inv.rtnCode,
      rtnMsg: inv.rtnMsg,
      ageHours,
    };
  }

  // 超過 24h → 走折讓
  if (!input.notifyEmail) {
    return {
      mode: "skipped",
      ok: false,
      ageHours,
      skipReason: "no_notify_email",
      rtnMsg: "超過 24h 需開折讓,但沒 notify email,跳過(需人工處理)",
    };
  }

  try {
    const allow = await allowanceInvoice({
      invoiceNumber: input.invoiceNumber,
      invoiceDate,
      itemName: input.itemName ?? "木作藍圖訂閱退費折讓",
      amount: input.refundAmount,
      notifyEmail: input.notifyEmail,
      customerName: input.customerName,
    });
    if (allow.success && allow.allowanceNumber) {
      await svc
        .from("payments")
        .update({
          invoice_status: "allowanced",
          allowance_number: allow.allowanceNumber,
          allowance_issued_at: allow.allowanceDate
            ? new Date(allow.allowanceDate).toISOString()
            : new Date().toISOString(),
          allowance_amount: input.refundAmount,
        })
        .eq("id", input.paymentId);
    }
    return {
      mode: "allowanced",
      ok: allow.success,
      rtnCode: allow.rtnCode,
      rtnMsg: allow.rtnMsg,
      allowanceNumber: allow.allowanceNumber,
      allowanceAmount: input.refundAmount,
      ageHours,
    };
  } catch (e) {
    return {
      mode: "allowanced",
      ok: false,
      ageHours,
      rtnMsg: e instanceof Error ? e.message : String(e),
    };
  }
}
