/**
 * 綠界退款 API — admin approve 退費後自動呼叫
 *
 * 信用卡退款用 CreditDetail/DoAction、Action=R。
 * 月扣 + 一次性付款都走同 endpoint（綠界 backend 用 MerchantTradeNo + TradeNo 對應）。
 *
 * 限制（綠界規則）：
 * - 信用卡退款只能在「請款後 6 個月內」執行（綠界默認 T+1 自動請款，所以實際上
 *   只有付款後 6 個月內可退）
 * - 同筆 TradeNo 不可重複退款（部分退款可、但 total 不能超過原 amount）
 * - 月扣每期視同獨立交易、每期有自己的 TradeNo、可單獨退某一期
 *
 * 回應：
 *   "1|..." → 成功
 *   "0|errorMessage" → 失敗
 */
import { calculateCheckMacValue } from "./check-mac-value";
import {
  ECPAY_CREDIT_DETAIL_DOACTION_URL,
  ECPAY_HASH_IV,
  ECPAY_HASH_KEY,
  ECPAY_MERCHANT_ID,
  assertEcpayConfigured,
} from "./config";

export interface RefundInput {
  /** 我們的 orderId、綠界 MerchantTradeNo */
  merchantTradeNo: string;
  /** 綠界 TradeNo（callback 帶來的） */
  tradeNo: string;
  /** 退款金額（NTD、整數） */
  amount: number;
}

export interface RefundResult {
  ok: boolean;
  /** 綠界回應 status (1=成功 / 0=失敗) */
  rtnCode?: string;
  /** 綠界回應訊息 */
  rtnMsg?: string;
  /** raw 回應字串、debug 用 */
  raw?: string;
  /** 失敗時的 error reason */
  error?: string;
}

/**
 * 對綠界發退款請求。
 *
 * 注意：env 沒設好（sandbox dev mode）會直接 return { ok: false, error: "not_configured" }、
 * 不會 throw，避免 admin approve flow 整個炸掉。
 */
export async function requestRefund(input: RefundInput): Promise<RefundResult> {
  try {
    assertEcpayConfigured();
  } catch {
    return { ok: false, error: "not_configured" };
  }

  if (!input.merchantTradeNo || !input.tradeNo) {
    return { ok: false, error: "missing_trade_info" };
  }
  if (input.amount <= 0) {
    return { ok: false, error: "invalid_amount" };
  }

  const params: Record<string, string> = {
    MerchantID: ECPAY_MERCHANT_ID,
    MerchantTradeNo: input.merchantTradeNo,
    TradeNo: input.tradeNo,
    Action: "R", // refund
    TotalAmount: String(input.amount),
  };
  params.CheckMacValue = calculateCheckMacValue(
    params,
    ECPAY_HASH_KEY,
    ECPAY_HASH_IV,
  );

  try {
    const formBody = new URLSearchParams(params).toString();
    const res = await fetch(ECPAY_CREDIT_DETAIL_DOACTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody,
    });
    const text = await res.text();
    // 綠界回應格式：「1|請求成功」or「0|錯誤訊息」
    // 也有「JSON」格式可選、但 default 是 string，這裡先收 string
    const [code, ...rest] = text.split("|");
    const msg = rest.join("|");
    const ok = code === "1";

    console.log("[ecpay/refund] response", {
      orderId: input.merchantTradeNo,
      tradeNo: input.tradeNo,
      amount: input.amount,
      rtnCode: code,
      rtnMsg: msg,
      httpStatus: res.status,
    });

    return { ok, rtnCode: code, rtnMsg: msg, raw: text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ecpay/refund] fetch error", msg);
    return { ok: false, error: msg };
  }
}
