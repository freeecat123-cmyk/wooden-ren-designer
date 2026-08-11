/**
 * Lemon Squeezy 測試模式事件不能寫進帳務。
 *
 * 為什麼這個檔案值得測：LS 的測試 store 事件走**同一支 endpoint、同一把簽章密鑰**，
 * payload 逐欄跟正式一樣只多 test_mode=true。實查線上已經因此在正式 payments 表
 * 留下 10 筆假的 success，而且測試訂閱還在每月續扣、每月再長一筆。
 *
 * 斷言下在「**帳務表有沒有被碰**」那一層（payments / subscriptions / users），
 * 而不是 log 表——log 是刻意留著的觀測，擋掉的事件仍然要看得到。
 *
 * 每條「擋下來」配一條負向對照（同 payload 只把 test_mode 翻成 false），
 * 證明 fixture 真的跑得到寫入那一步，不是因為別的原因提早結束而假通過。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let touchedTables: string[];
let afterCallbacks: Array<() => Promise<unknown>>;
let updates: Array<{ table: string; row: Record<string, unknown> }>;
let upserts: Array<{ table: string; row: unknown }>;
let sendEmailCalls: unknown[];

vi.mock("@/lib/lemon-squeezy/webhook", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    verifyLemonWebhook: () => true,
    extractEventId: (p: { data: { id: string } }) => `evt-${p.data.id}`,
  };
});

vi.mock("next/server", () => ({
  after: (cb: () => Promise<unknown>) => {
    afterCallbacks.push(cb);
  },
}));

vi.mock("@/lib/email/send", () => ({
  FROM_EN: "test@example.com",
  sendEmail: async (payload: unknown) => {
    sendEmailCalls.push(payload);
  },
}));

/** 帳務表 = 這些；log 表刻意不算，擋掉的事件仍然要留紀錄。 */
const LEDGER_TABLES = ["payments", "subscriptions", "users", "template_unlocks", "tool_unlocks"];

function makeQuery(table: string, result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    update: (row: Record<string, unknown>) => {
      updates.push({ table, row });
      return q;
    },
    upsert: (row: unknown) => {
      upserts.push({ table, row });
      return q;
    },
    insert: () => q,
    maybeSingle: async () => result,
    single: async () => result,
    then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
  };
  return q;
}

let tableResults: Record<string, { data: unknown; error: unknown }>;

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      touchedTables.push(table);
      return makeQuery(table, tableResults[table] ?? { data: null, error: null });
    },
  }),
}));

const { POST } = await import("./webhook/route");

/** 一筆續扣成功事件：走 subscriptions → payments → users，三張帳務表都會碰到。 */
function paymentSuccessEvent(testMode: boolean): Request {
  const payload = {
    meta: { event_name: "subscription_payment_success" },
    data: {
      type: "subscription-invoices",
      id: "8027249",
      attributes: {
        subscription_id: 7739083,
        user_email: "freeecat123@gmail.com",
        total: 900,
        test_mode: testMode,
      },
    },
  };
  return new Request("https://designer.woodenren.com/api/lemon-squeezy/webhook", {
    method: "POST",
    headers: { "x-signature": "whatever" },
    body: JSON.stringify(payload),
  });
}

async function runAfterCallbacks(): Promise<void> {
  for (const cb of afterCallbacks) await cb();
}

const ledgerTouched = () => touchedTables.filter((t) => LEDGER_TABLES.includes(t));

beforeEach(() => {
  touchedTables = [];
  afterCallbacks = [];
  updates = [];
  upserts = [];
  sendEmailCalls = [];
  tableResults = {
    lemonsqueezy_webhook_log: { data: null, error: null },
    subscriptions: { data: { user_id: "user-1" }, error: null },
    payments: { data: null, error: null },
    users: { data: { email: "freeecat123@gmail.com" }, error: null },
  };
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("/api/lemon-squeezy/webhook 測試模式", () => {
  it("test_mode=true：一張帳務表都不碰", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await POST(paymentSuccessEvent(true) as any);
    await runAfterCallbacks();

    expect(ledgerTouched()).toEqual([]);
    expect(upserts).toEqual([]);
  });

  it("test_mode=true：仍回 200 且仍留下 log（LS 收不到 2xx 會重送；log 是刻意保留的觀測）", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(paymentSuccessEvent(true) as any);
    // 這行不能省：守門被拿掉時寫入是排進 after() 背景回呼的，不跑它就看不到帳務被碰，
    // 下面那條「帳務沒被碰」會假通過（第一版就是這樣漏掉的）。
    await runAfterCallbacks();

    expect(res.status).toBe(200);
    expect(touchedTables).toContain("lemonsqueezy_webhook_log");
    expect(ledgerTouched()).toEqual([]);
  });

  it("test_mode=true：log 標記成 skipped，admin 才看得出它被擋掉而不是漏處理", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await POST(paymentSuccessEvent(true) as any);

    const marked = updates.find((u) => u.table === "lemonsqueezy_webhook_log");
    expect(String(marked?.row.processing_error)).toContain("test_mode");
  });

  it("負向對照：test_mode=false 時照樣寫 payments、標 users active", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await POST(paymentSuccessEvent(false) as any);
    await runAfterCallbacks();

    expect(ledgerTouched()).toContain("subscriptions");
    expect(upserts.map((u) => u.table)).toContain("payments");
    expect(updates.some((u) => u.table === "users")).toBe(true);
  });
});
