/**
 * 付款成功後呼叫綠界開立 B2C 電子發票，並把結果寫回 payments.invoice_*
 *
 * 設計：
 *   - caller 已經 INSERT 了 payments（status=success），把 paymentId 傳進來
 *   - 從 users.invoice_preference 讀使用者偏好（缺值 → 預設個人會員載具）
 *   - 收件 email 預設 user.email，可被 preference.email 覆蓋
 *   - 失敗時把 invoice_status 設 failed，不 throw — caller 不要因發票失敗就讓綠界
 *     webhook 噴 500（綠界會無限重送）
 *   - idempotent：先檢查 payments.invoice_number 已有值就 skip
 *
 * RelateNumber 策略：用 payment id（UUID 去 dash）就保證唯一了，比月扣訂單編號
 * 還安全（同一定期定額第 N 期共用 MerchantTradeNo，但每期 payment id 不同）。
 */
import { type SupabaseClient } from "@supabase/supabase-js";
import { issueInvoice } from "./invoice";
import { type InvoicePreference } from "./invoice-config";

interface IssueInvoiceForPaymentInput {
  paymentId: string;
  userId: string;
  amount: number;
  itemName: string;
}

export async function issueInvoiceForPayment(
  admin: SupabaseClient,
  input: IssueInvoiceForPaymentInput,
): Promise<void> {
  // idempotency：已開過就不再開
  const { data: existing } = await admin
    .from("payments")
    .select("invoice_number, invoice_status")
    .eq("id", input.paymentId)
    .single();
  if (existing?.invoice_number) {
    return;
  }

  const { data: user } = await admin
    .from("users")
    .select("email, invoice_preference")
    .eq("id", input.userId)
    .single();

  if (!user?.email) {
    console.error("[invoice] 找不到使用者 email，跳過開立", {
      paymentId: input.paymentId,
    });
    await admin
      .from("payments")
      .update({ invoice_status: "failed" })
      .eq("id", input.paymentId);
    return;
  }

  const pref = (user.invoice_preference as InvoicePreference | null) ?? null;
  // RelateNumber 須英數，UUID 去 dash 後是 32 字（符合綠界 50 字上限）
  const relateNumber = input.paymentId.replace(/-/g, "").slice(0, 32);

  try {
    const result = await issueInvoice({
      relateNumber,
      itemName: input.itemName,
      amount: input.amount,
      email: user.email,
      preference: pref,
    });

    if (result.success && result.invoiceNumber) {
      await admin
        .from("payments")
        .update({
          invoice_number: result.invoiceNumber,
          invoice_relate_number: relateNumber,
          invoice_issued_at: new Date().toISOString(),
          invoice_status: "issued",
        })
        .eq("id", input.paymentId);
      console.log("[invoice] 開立成功", {
        paymentId: input.paymentId,
        invoiceNumber: result.invoiceNumber,
      });
    } else {
      console.error("[invoice] RtnCode != 1", {
        paymentId: input.paymentId,
        rtnCode: result.rtnCode,
        rtnMsg: result.rtnMsg,
      });
      await admin
        .from("payments")
        .update({
          invoice_relate_number: relateNumber,
          invoice_status: "failed",
        })
        .eq("id", input.paymentId);
    }
  } catch (e) {
    console.error("[invoice] 開立發票例外", {
      paymentId: input.paymentId,
      error: e instanceof Error ? e.message : String(e),
    });
    await admin
      .from("payments")
      .update({
        invoice_relate_number: relateNumber,
        invoice_status: "failed",
      })
      .eq("id", input.paymentId);
  }
}
