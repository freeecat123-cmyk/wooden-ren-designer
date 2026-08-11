/**
 * 綠界「模擬付款」不能被當成真的付款。
 *
 * 為什麼這個檔案值得測：綠界後台按下模擬付款送過來的回呼，RtnCode 一樣是 1，
 * 跟真的付款成功只差一個 SimulatePaid=1。兩支 webhook 原本只看 RtnCode，
 * 於是一顆測試按鈕就會：寫永久買斷、把訂閱打成 active、開一張財政部認得的
 * 真發票（線上字軌 DQ／BS 已經在跑），而綠界根本不會撥款。
 *
 * 所以這裡的斷言刻意下在「有沒有碰資料庫」這一層 —— 只要守門被拿掉，
 * createAdminClient 就會被呼叫，測試立刻紅，不必去猜它後面錯在哪一條分支。
 *
 * 每個「擋下來」的測試都配一條**負向對照**（同一份 payload 只把 SimulatePaid
 * 拿掉），證明這份 fixture 真的跑得到出貨那一步 —— 否則測試可能只是因為
 * 別的原因提早結束而假通過。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const MERCHANT_ID = "3179581";

/** 每個測試自己清空。 */
let fromCalls: string[];
let createAdminCalls: number;
let afterCallbacks: Array<() => Promise<unknown>>;
let issueInvoiceCalls: unknown[];
let sendEmailCalls: unknown[];
let inserts: Array<{ table: string; row: unknown }>;

/** CheckMacValue 本身不是這裡的主題，一律當作驗過。 */
vi.mock("@/lib/ecpay/check-mac-value", () => ({
  verifyCheckMacValue: () => true,
  calculateCheckMacValue: () => "MAC",
}));

vi.mock("next/server", () => ({
  after: (cb: () => Promise<unknown>) => {
    afterCallbacks.push(cb);
  },
}));

vi.mock("@/lib/ecpay/issue-invoice-for-payment", () => ({
  issueInvoiceForPayment: async (_admin: unknown, input: unknown) => {
    issueInvoiceCalls.push(input);
  },
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: async (payload: unknown) => {
    sendEmailCalls.push(payload);
  },
}));

// 這三支會打綠界的外部 API，測試裡一律不准出門。
vi.mock("@/lib/ecpay/refund", () => ({ requestRefund: async () => ({ ok: true }) }));
vi.mock("@/lib/ecpay/terminate", () => ({
  terminateEcpayPeriodic: async () => ({ ok: true }),
}));
vi.mock("@/lib/ecpay/invoice-after-refund", () => ({
  voidOrAllowanceAfterRefund: async () => ({ ok: true, mode: "void", ageHours: 0 }),
}));

/** 一筆等待付款的 CNC 499 買斷訂單。 */
const PENDING_UNLOCK = {
  id: "pay-1",
  user_id: "user-1",
  amount: 499,
  status: "pending",
  raw_response: { orderId: "ORDER1", kind: "tool_unlock", tool: "cnc" },
};

const ACTIVE_SUB = {
  id: "sub-1",
  user_id: "user-1",
  plan: "personal",
  status: "expired",
  expires_at: new Date().toISOString(),
  expected_amount: 390,
};

/** 夠用的假 supabase：鏈式呼叫全部回自己，await 得到該表設定的結果。 */
function makeQuery(table: string, result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {
    select: () => q,
    in: () => q,
    filter: () => q,
    or: () => q,
    eq: () => q,
    neq: () => q,
    order: () => q,
    limit: () => q,
    update: () => q,
    insert: (row: unknown) => {
      inserts.push({ table, row });
      return q;
    },
    maybeSingle: async () => result,
    single: async () => result,
    then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
  };
  return q;
}

let tableResults: Record<string, { data: unknown; error: unknown }>;

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => {
    createAdminCalls += 1;
    return {
      from: (table: string) => {
        fromCalls.push(table);
        return makeQuery(table, tableResults[table] ?? { data: null, error: null });
      },
    };
  },
}));

const { POST: returnPOST } = await import("./return/route");
const { POST: periodicPOST } = await import("./periodic-notify/route");

/** 綠界回呼是 form-data。 */
function callback(extra: Record<string, string>): Request {
  const fd = new FormData();
  const base: Record<string, string> = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: "ORDER1",
    TradeNo: `TN${Math.floor(performance.now() * 1000)}`,
    RtnCode: "1",
    RtnMsg: "Succeeded",
    TradeAmt: "499",
    PaymentDate: "2026/08/11 20:00:00",
    PaymentType: "Credit_CreditCard",
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) fd.append(k, v);
  return new Request("https://designer.woodenren.com/api/ecpay/return", {
    method: "POST",
    body: fd,
  });
}

async function runAfterCallbacks(): Promise<void> {
  for (const cb of afterCallbacks) await cb();
}

beforeEach(() => {
  fromCalls = [];
  createAdminCalls = 0;
  afterCallbacks = [];
  issueInvoiceCalls = [];
  sendEmailCalls = [];
  inserts = [];
  tableResults = {
    payments: { data: PENDING_UNLOCK, error: null },
    tool_unlocks: { data: null, error: null },
    template_unlocks: { data: null, error: null },
    subscriptions: { data: ACTIVE_SUB, error: null },
    users: { data: { email: "buyer@example.com" }, error: null },
    survey_coupons: { data: null, error: null },
  };
  process.env.ECPAY_MERCHANT_ID = MERCHANT_ID;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("/api/ecpay/return", () => {
  it("SimulatePaid=1：碰都不碰資料庫，不開發票、不寄信", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await returnPOST(callback({ SimulatePaid: "1" }) as any);
    await runAfterCallbacks();

    expect(createAdminCalls).toBe(0);
    expect(fromCalls).toEqual([]);
    expect(inserts).toEqual([]);
    expect(issueInvoiceCalls).toEqual([]);
    expect(sendEmailCalls).toEqual([]);
  });

  it("SimulatePaid=1：擋下來但仍回 1|OK（綠界後台要看到這個才算 ReturnURL 測通，回別的會被無限重送）", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await returnPOST(callback({ SimulatePaid: "1" }) as any);
    expect(await res.text()).toBe("1|OK");
    // 沒有這一行的話，這條測試在守門被拿掉時照樣會綠——出貨路徑最後也是回 1|OK。
    expect(createAdminCalls).toBe(0);
  });

  it("負向對照：同一份 payload 沒有 SimulatePaid，就會真的解鎖 + 開發票", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await returnPOST(callback({ SimulatePaid: "0" }) as any);
    await runAfterCallbacks();

    // 這條若掛了，代表上面兩條的「沒發生」是假通過（根本沒跑到出貨那一步）
    expect(inserts.map((i) => i.table)).toContain("tool_unlocks");
    expect(issueInvoiceCalls).toHaveLength(1);
    expect(sendEmailCalls).toHaveLength(1);
  });

  it("SimulatePaid 前後有空白也算模擬付款", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await returnPOST(callback({ SimulatePaid: " 1 " }) as any);
    expect(createAdminCalls).toBe(0);
  });
});

describe("/api/ecpay/periodic-notify", () => {
  it("SimulatePaid=1：不續期、不開發票", async () => {
    const res = await periodicPOST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback({ SimulatePaid: "1", PeriodType: "M", PeriodAmount: "390" }) as any,
    );
    await runAfterCallbacks();

    expect(createAdminCalls).toBe(0);
    expect(issueInvoiceCalls).toEqual([]);
    expect(await res.text()).toBe("1|OK");
  });

  it("負向對照：沒有 SimulatePaid 時照樣會去撈 subscription", async () => {
    await periodicPOST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback({ PeriodType: "M", PeriodAmount: "390" }) as any,
    );
    expect(fromCalls).toContain("subscriptions");
  });
});
