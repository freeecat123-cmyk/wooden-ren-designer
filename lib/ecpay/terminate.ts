/**
 * 呼叫綠界 Action=Terminate 終止信用卡定期定額協議。
 * 抽 helper 給多處共用 (cancel-subscription API + 升級流程 checkout)。
 *
 * 回傳:
 *   { ok: true } 終止成功
 *   { ok: false, error, rtnCode?, rtnMsg? } 任一失敗 (網路 / 綠界 reject)
 */
import { buildPeriodicTerminateParams } from "@/lib/ecpay/create-order";
import { ECPAY_CREDIT_PERIOD_ACTION_URL } from "@/lib/ecpay/config";

export interface TerminateResult {
  ok: boolean;
  error?: string;
  rtnCode?: string | null;
  rtnMsg?: string | null;
}

export async function terminateEcpayPeriodic(merchantTradeNo: string): Promise<TerminateResult> {
  const ecpayParams = buildPeriodicTerminateParams(merchantTradeNo);
  const body = new URLSearchParams(ecpayParams).toString();

  let raw = "";
  try {
    const r = await fetch(ECPAY_CREDIT_PERIOD_ACTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    raw = await r.text();
  } catch (e) {
    console.error("[ecpay/terminate] 呼叫綠界 Terminate 失敗", e);
    return { ok: false, error: "ecpay_unreachable" };
  }

  const parsed = new URLSearchParams(raw);
  const rtnCode = parsed.get("RtnCode");
  const rtnMsg = parsed.get("RtnMsg");

  if (rtnCode !== "1") {
    console.error("[ecpay/terminate] 綠界 Terminate 失敗", { merchantTradeNo, rtnCode, rtnMsg, raw });
    return { ok: false, error: "ecpay_terminate_failed", rtnCode, rtnMsg };
  }

  return { ok: true, rtnCode, rtnMsg };
}
