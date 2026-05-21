/**
 * 綠界 ATM/超商/條碼「取號」回呼參數的解析。
 * 純函式，不碰 DB / 不打網路，方便獨立驗證。
 */

export type PaymentMethod = "atm" | "cvs" | "barcode";

/** 寫進 payments.payment_info jsonb 的形狀 */
export interface PaymentInfo {
  method: PaymentMethod;
  /** 繳費期限，ISO 字串 */
  expireDate: string;
  bankCode?: string; // ATM
  vAccount?: string; // ATM 虛擬帳號
  paymentNo?: string; // 超商代碼
  barcode1?: string; // 超商條碼三段
  barcode2?: string;
  barcode3?: string;
}

/**
 * 綠界 ExpireDate 轉 ISO。
 * ATM 格式 "yyyy/MM/dd"；超商/條碼格式 "yyyy/MM/dd HH:mm:ss"。皆視為 UTC+8。
 */
export function parseEcpayExpireDate(s: string | undefined): string | null {
  if (!s) return null;
  const full = s.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (full) {
    return new Date(
      `${full[1]}-${full[2]}-${full[3]}T${full[4]}:${full[5]}:${full[6]}+08:00`,
    ).toISOString();
  }
  const dateOnly = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (dateOnly) {
    // 只有日期 → 當天 23:59:59 截止
    return new Date(
      `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T23:59:59+08:00`,
    ).toISOString();
  }
  return null;
}

/** 取號是否成功：ATM RtnCode=2、超商/條碼 RtnCode=10100073 */
export function isGetCodeSuccess(rtnCode: string | undefined): boolean {
  return rtnCode === "2" || rtnCode === "10100073";
}

/** 由綠界 PaymentType 前綴判付款方式（ATM_TAISHIN / CVS_CVS / BARCODE_BARCODE …） */
export function classifyPaymentMethod(
  paymentType: string | undefined,
): PaymentMethod | null {
  if (!paymentType) return null;
  if (paymentType.startsWith("ATM_")) return "atm";
  if (paymentType.startsWith("CVS_")) return "cvs";
  if (paymentType.startsWith("BARCODE_")) return "barcode";
  return null;
}

/**
 * 從取號回呼 params 組出 PaymentInfo。
 * 缺必要欄位（method 判不出 / 無 expireDate / 無帳號代碼）回 null。
 */
export function buildPaymentInfo(
  params: Record<string, string>,
): PaymentInfo | null {
  const method = classifyPaymentMethod(params.PaymentType);
  if (!method) return null;
  const expireDate = parseEcpayExpireDate(params.ExpireDate);
  if (!expireDate) return null;

  if (method === "atm") {
    if (!params.BankCode || !params.vAccount) return null;
    return {
      method,
      expireDate,
      bankCode: params.BankCode,
      vAccount: params.vAccount,
    };
  }
  if (method === "cvs") {
    if (!params.PaymentNo) return null;
    return { method, expireDate, paymentNo: params.PaymentNo };
  }
  // barcode
  if (!params.Barcode1) return null;
  return {
    method,
    expireDate,
    barcode1: params.Barcode1,
    barcode2: params.Barcode2,
    barcode3: params.Barcode3,
  };
}
