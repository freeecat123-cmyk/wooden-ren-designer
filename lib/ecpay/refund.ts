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
  ECPAY_CREDIT_PERIOD_ACTION_URL,
  ECPAY_HASH_IV,
  ECPAY_HASH_KEY,
  ECPAY_MERCHANT_ID,
  assertEcpayConfigured,
} from "./config";
import { buildPeriodicTerminateParams } from "./create-order";

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

/**
 * 終止信用卡定期定額（停止未來扣款，已扣不退）
 *
 * 為什麼要獨立 function：
 *   - 退款 ≠ 終止。要退款下個月不再扣，必須兩個動作都做
 *   - admin refund 流程必須先 Terminate（防止下個月又扣）再 Refund（退本期）
 *
 * 限制：
 *   - 只對「定期定額」訂單有效（一次性訂單呼叫會 RtnCode != 1）
 *   - 同一 MerchantTradeNo 重複呼叫第二次會回失敗，視為「已終止」處理
 */
export async function terminatePeriodicSubscription(
  merchantTradeNo: string,
): Promise<RefundResult> {
  try {
    assertEcpayConfigured();
  } catch {
    return { ok: false, error: "not_configured" };
  }
  if (!merchantTradeNo) {
    return { ok: false, error: "missing_trade_no" };
  }

  const params = buildPeriodicTerminateParams(merchantTradeNo);
  try {
    const res = await fetch(ECPAY_CREDIT_PERIOD_ACTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    const text = await res.text();
    // CreditCardPeriodAction 回應為 urlencoded form 含 RtnCode/RtnMsg
    const parsed = new URLSearchParams(text);
    const rtnCode = parsed.get("RtnCode") ?? "";
    const rtnMsg = parsed.get("RtnMsg") ?? "";
    const ok = rtnCode === "1";
    console.log("[ecpay/terminate] response", {
      orderId: merchantTradeNo,
      rtnCode,
      rtnMsg,
    });
    return { ok, rtnCode, rtnMsg, raw: text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ecpay/terminate] fetch error", msg);
    return { ok: false, error: msg };
  }
}

/**
 * 查詢信用卡定期定額狀態（給對帳 cron 用）
 *
 * 端點：/Cashier/QueryCreditCardPeriodInfo（與 Action 不同 endpoint）
 * 回傳含 `Status` 欄位：
 *   "已完成" / "執行中" / "停止中" / "終止" / "失敗"
 * 我們關心 "終止" — 代表綠界後台被手動停了、DB 仍 active = 該對帳同步
 */
export interface PeriodicQueryResult {
  ok: boolean;
  /** 綠界狀態描述（中文） */
  status?: string;
  /** 已扣款次數 */
  totalSuccessTimes?: number;
  /** 已扣款金額累計 */
  totalAmount?: number;
  raw?: string;
  error?: string;
}

export async function queryPeriodicStatus(
  merchantTradeNo: string,
): Promise<PeriodicQueryResult> {
  try {
    assertEcpayConfigured();
  } catch {
    return { ok: false, error: "not_configured" };
  }
  if (!merchantTradeNo) {
    return { ok: false, error: "missing_trade_no" };
  }

  const params: Record<string, string> = {
    MerchantID: ECPAY_MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };
  params.CheckMacValue = calculateCheckMacValue(
    params,
    ECPAY_HASH_KEY,
    ECPAY_HASH_IV,
  );

  // 端點同 ECPAY_CREDIT_PERIOD_ACTION_URL 的 base，path 改 QueryCreditCardPeriodInfo
  const queryUrl = ECPAY_CREDIT_PERIOD_ACTION_URL.replace(
    "/Cashier/CreditCardPeriodAction",
    "/Cashier/QueryCreditCardPeriodInfo",
  );

  try {
    const res = await fetch(queryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    const text = await res.text();
    // 綠界回 JSON（這個 endpoint 是少數回 JSON 的金流 API）
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // 也可能回 urlencoded（依綠界後台設定）
      const parsed = new URLSearchParams(text);
      parsed.forEach((v, k) => {
        json[k] = v;
      });
    }
    return {
      ok: true,
      status: typeof json.Status === "string" ? json.Status : undefined,
      totalSuccessTimes:
        typeof json.TotalSuccessTimes === "number"
          ? json.TotalSuccessTimes
          : Number(json.TotalSuccessTimes ?? 0) || 0,
      totalAmount:
        typeof json.TotalSuccessAmount === "number"
          ? json.TotalSuccessAmount
          : Number(json.TotalSuccessAmount ?? 0) || 0,
      raw: text,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ecpay/query-periodic] fetch error", msg);
    return { ok: false, error: msg };
  }
}
