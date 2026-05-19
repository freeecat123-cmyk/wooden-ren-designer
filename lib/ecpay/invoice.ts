/**
 * 綠界 B2C 電子發票 API client（V3 AES-JSON 協議）
 *
 * 與金流（AIO/CMV-SHA256）不同：發票走 AES-128-CBC + Base64，request body 為三層 JSON
 * （外層 TransCode → 解密 Data → 內層 RtnCode），兩層都要檢查。
 *
 * 為什麼自己寫：綠界沒提供官方 Node.js SDK；TypeScript 環境只能手刻。
 * 加密 / encode 規則嚴格依照官方文件（refs:
 *   guides/04-invoice-b2c.md
 *   guides/14-aes-encryption.md
 *   references/Invoice/B2C電子發票介接技術文件.md → developers.ecpay.com.tw/7896.md）
 */
import { createCipheriv, createDecipheriv } from "node:crypto";
import {
  INVOICE_BASE_URL,
  INVOICE_HASH_IV,
  INVOICE_HASH_KEY,
  INVOICE_MERCHANT_ID,
  type InvoicePreference,
} from "./invoice-config";

/**
 * aesUrlEncode — 對應 PHP urlencode 的編碼規則
 *
 * 與 CMV 的 ecpayUrlEncode 不同：
 *   - CMV 全部轉小寫 (`%7E` → `%7e`)，AES 不轉
 *   - 兩者都要把 ` ` → `+`、`~` → `%7E`、`!'()*` 也要編碼
 *   - 混用會讓 CheckMacValue（CMV）或 TransCode（AES）永遠錯誤
 */
function aesUrlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/%20/g, "+")
    .replace(/~/g, "%7E")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

function aesUrlDecode(s: string): string {
  return decodeURIComponent(s.replace(/\+/g, "%20"));
}

function aesEncrypt(data: unknown): string {
  const json = JSON.stringify(data);
  const encoded = aesUrlEncode(json);
  const key = Buffer.from(INVOICE_HASH_KEY, "utf8").subarray(0, 16);
  const iv = Buffer.from(INVOICE_HASH_IV, "utf8").subarray(0, 16);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([cipher.update(encoded, "utf8"), cipher.final()]).toString(
    "base64",
  );
}

function aesDecrypt(b64: string): unknown {
  const key = Buffer.from(INVOICE_HASH_KEY, "utf8").subarray(0, 16);
  const iv = Buffer.from(INVOICE_HASH_IV, "utf8").subarray(0, 16);
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  const raw = Buffer.concat([
    decipher.update(Buffer.from(b64, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(aesUrlDecode(raw));
}

interface EcpayEnvelopeResponse {
  PlatformID?: string;
  MerchantID?: string;
  RpHeader?: { Timestamp?: number };
  TransCode: number;
  TransMsg?: string;
  Data?: string;
}

/**
 * 統一的 POST 工具：自動包外層 + 解三層回應。
 * 失敗時 throw — caller 應該 try/catch 但**不要讓發票錯誤影響付款 webhook 回 200**。
 */
async function postInvoice<T>(
  endpoint: string,
  innerData: Record<string, unknown>,
): Promise<T> {
  const url = `${INVOICE_BASE_URL}${endpoint}`;
  const body = {
    MerchantID: INVOICE_MERCHANT_ID,
    RqHeader: {
      Timestamp: Math.floor(Date.now() / 1000),
      Revision: "3.0.0",
    },
    Data: aesEncrypt({ MerchantID: INVOICE_MERCHANT_ID, ...innerData }),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `[ecpay-invoice] HTTP ${res.status} from ${endpoint}: ${await res.text()}`,
    );
  }
  const env = (await res.json()) as EcpayEnvelopeResponse;
  if (env.TransCode !== 1) {
    throw new Error(
      `[ecpay-invoice] TransCode=${env.TransCode} TransMsg=${env.TransMsg}（AES/格式錯誤，未進入業務層）`,
    );
  }
  if (!env.Data) {
    throw new Error("[ecpay-invoice] TransCode=1 但 Data 為空");
  }
  return aesDecrypt(env.Data) as T;
}

// ─────────────────────────────────────────────────────────────────────
// Issue（開立發票）
// ─────────────────────────────────────────────────────────────────────

export interface IssueInvoiceInput {
  /** 我們自己的訂單追蹤碼，會作為 RelateNumber 送給綠界（每次唯一、僅英數） */
  relateNumber: string;
  /** 商品名稱（會印在發票上） */
  itemName: string;
  /** 金額（含稅；NT$ 整數） */
  amount: number;
  /** 收件 email（會收到發票通知） */
  email: string;
  /** 使用者的發票偏好；無 = 預設個人無載具 */
  preference?: InvoicePreference | null;
}

interface IssueResponse {
  RtnCode: number;
  RtnMsg: string;
  InvoiceNo?: string;
  InvoiceDate?: string;
  RandomNumber?: string;
}

/**
 * 把 InvoicePreference 對映到綠界 Issue API 的欄位。
 *
 * 規則來源：guides/04-invoice-b2c.md「Issue（開立發票）必填欄位速查」
 *   - CarrierType="3" 手機條碼（需 CarrierNum 格式 /XXX+XXX）
 *   - CarrierType="1" 綠界會員載具
 *   - CarrierType=""  無載具（紙本或公司戶）
 *   - 有統編 → CustomerIdentifier 8 碼，Donation 必須 "0"，CarrierType 留空
 *   - Print="1" 列印紙本（公司戶才需，個人都用雲端）
 */
function buildIssueData(input: IssueInvoiceInput): Record<string, unknown> {
  const pref = input.preference ?? {};
  const isCompany = pref.type === "company" && pref.taxId && pref.title;

  const base: Record<string, unknown> = {
    RelateNumber: input.relateNumber,
    CustomerEmail: pref.email || input.email,
    Donation: "0",
    TaxType: "1", // 應稅
    SalesAmount: input.amount,
    InvType: "07", // 一般稅額
    Items: [
      {
        ItemName: input.itemName,
        ItemCount: 1,
        ItemWord: "次",
        ItemPrice: input.amount,
        ItemTaxType: "1",
        ItemAmount: input.amount,
      },
    ],
  };

  if (isCompany) {
    return {
      ...base,
      CustomerIdentifier: pref.taxId,
      CustomerName: pref.title,
      Print: "0", // 雲端發票（綠界仍會寄 email 跟給財政部）
      CarrierType: "", // 統編 + 載具不可並存
    };
  }

  // 個人：載具優先順序 手機條碼 > 綠界會員載具 > 無
  if (pref.carrierType === "mobile" && pref.carrierNum) {
    return {
      ...base,
      Print: "0",
      CarrierType: "3",
      CarrierNum: pref.carrierNum,
    };
  }
  return {
    ...base,
    Print: "0",
    CarrierType: "1", // 綠界會員載具（最通用、不需使用者額外輸入）
  };
}

export interface IssueInvoiceResult {
  success: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  rtnCode: number;
  rtnMsg: string;
}

export async function issueInvoice(
  input: IssueInvoiceInput,
): Promise<IssueInvoiceResult> {
  const data = buildIssueData(input);
  const res = await postInvoice<IssueResponse>("/B2CInvoice/Issue", data);
  return {
    success: res.RtnCode === 1,
    invoiceNumber: res.InvoiceNo,
    invoiceDate: res.InvoiceDate,
    rtnCode: res.RtnCode,
    rtnMsg: res.RtnMsg,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Invalid（作廢發票）— 退款後可在 24 小時內作廢；超過要用折讓 Allowance
// ─────────────────────────────────────────────────────────────────────

export interface InvalidInvoiceInput {
  invoiceNumber: string;
  /** ISO date YYYY-MM-DD（發票開立日） */
  invoiceDate: string;
  reason: string;
}

interface InvalidResponse {
  RtnCode: number;
  RtnMsg: string;
  InvoiceNo?: string;
}

export async function invalidInvoice(
  input: InvalidInvoiceInput,
): Promise<{ success: boolean; rtnCode: number; rtnMsg: string }> {
  const res = await postInvoice<InvalidResponse>("/B2CInvoice/Invalid", {
    InvoiceNo: input.invoiceNumber,
    InvoiceDate: input.invoiceDate,
    Reason: input.reason.slice(0, 20),
  });
  return { success: res.RtnCode === 1, rtnCode: res.RtnCode, rtnMsg: res.RtnMsg };
}

// 折讓 Allowance 留待 Step 5 實作（須等退款流程串完才有意義）
