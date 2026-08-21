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
/**
 * ⭐ 這個假 DB 原本只記 insert、把 update 的內容整包丟掉（`update: () => q`）。
 * 結果是「續扣成功卻沒還原 users.plan」這種**寫錯欄位**的 bug，再怎麼加測試都驗不到——
 * 因為根本沒人看得到 update 送了什麼。2026-08-21 稽核抓到後補上。
 */
let updates: Array<{ table: string; row: Record<string, unknown> }>;

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
function makeQuery(
  table: string,
  result: { data: unknown; error: unknown; insertResult?: { data: unknown; error: unknown } },
) {
  /**
   * ⭐ insert 之後的 `.select().single()` 要能回「剛插入那筆」,而不是 select 的結果。
   *   沒有這一層的話,payments 的 insert 永遠回 null → route 裡
   *   `if (insertedPayment?.id)` 包住的開發票區塊**永遠跳過**,
   *   於是「不開發票」這種測試不管程式對錯都會通過(橡皮圖章)。
   */
  let didInsert = false;
  const settle = async () =>
    didInsert && result.insertResult ? result.insertResult : result;
  const q: Record<string, unknown> = {
    select: () => q,
    in: () => q,
    filter: () => q,
    or: () => q,
    eq: () => q,
    neq: () => q,
    order: () => q,
    limit: () => q,
    update: (row: unknown) => {
      updates.push({ table, row: (row ?? {}) as Record<string, unknown> });
      return q;
    },
    insert: (row: unknown) => {
      inserts.push({ table, row });
      didInsert = true;
      return q;
    },
    maybeSingle: async () => settle(),
    single: async () => settle(),
    then: (res: (v: unknown) => unknown) => settle().then(res),
  };
  return q;
}

type TableResult = {
  data: unknown;
  error: unknown;
  /** insert 之後的 `.select().single()` 要回的東西（見 makeQuery 的說明）。 */
  insertResult?: { data: unknown; error: unknown };
};
let tableResults: Record<string, TableResult>;

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
  updates = [];
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

  /**
   * 🧷 續扣成功後「三個地方一起還原」。
   *
   * ⭐ 為什麼非測不可：ACTIVE_SUB 這筆 fixture 的 status 本來就是 "expired"，
   *   模擬的正是「漏繳一期被 sweep 降級、下一期又扣款成功」的真實情境。
   *   原本的程式只補 subscription_status 與到期日，**沒有寫回 users.plan**，
   *   於是 getEffectivePlan（lib/permissions.ts 最後一行 `return profile.plan`）回 'free'：
   *   客戶付了錢、拿到發票、收到成功信，網站功能全鎖。
   *   而 sweep 帶 `.not("plan","in","(free,lifetime)")`，之後再也掃不到他 → 永久卡死。
   */
  describe("續扣成功後的狀態還原", () => {
    const renew = async () => {
      // ⚠️ 這張假 DB 的 payments 預設回 PENDING_UNLOCK（買斷那組測試在用），
      //    但 route:124-136 會把「查得到同 TradeNo 的 payment」判成重送而提早 return。
      //    要走到續期那段，這裡必須是「查無此筆」。
      tableResults.payments = { data: null, error: null };
      await periodicPOST(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback({ PeriodType: "M", PeriodAmount: "390", TradeAmt: "390" }) as any,
      );
      await runAfterCallbacks();
      return {
        users: updates.filter((u) => u.table === "users").map((u) => u.row),
        subs: updates.filter((u) => u.table === "subscriptions").map((u) => u.row),
      };
    };

    it("① users.plan 要被寫回訂閱本身的方案（不能只補 status）", async () => {
      const { users } = await renew();
      const withPlan = users.find((r) => "plan" in r);
      expect(withPlan, "續扣成功卻完全沒有寫 users.plan").toBeDefined();
      expect(withPlan!.plan).toBe(ACTIVE_SUB.plan);
    });

    it("② 同一次 update 也要把 subscription_status 補成 active、帶新到期日", async () => {
      const { users } = await renew();
      const row = users.find((r) => "plan" in r)!;
      expect(row.subscription_status).toBe("active");
      expect(typeof row.subscription_expires_at).toBe("string");
    });

    it("③ subscriptions.status 要從 expired 還原成 active（不然對帳工具掃不到）", async () => {
      const { subs } = await renew();
      const row = subs.find((r) => "expires_at" in r);
      expect(row, "沒有更新 subscriptions").toBeDefined();
      expect(row!.status).toBe("active");
    });

    /**
     * 🧷 admin 後台「模擬月扣」：DB 要照跑（那正是要測的），但錢是假的 →
     *    **不可以開發票、不可以寄信、不可以算進營收**。
     *
     * ⭐ 修好之前這支工具送出的回呼帶 RtnCode=1 與正確的 CheckMacValue，
     *   跟真回呼完全無法區分 → 會對真實客戶開出一張**真號碼的財政部電子發票**、
     *   寄「扣款成功」信，帳上還多一筆永遠不會入帳的營收，事後只能作廢或折讓。
     */
    describe("admin 模擬月扣", () => {
      const simRenew = async () => {
        // select 查無此筆(不是重送) + insert 回一個 id(不然開票區塊被 optional chaining 跳過,
        // 「不開發票」就變成怎麼寫都會過的假測試)
        tableResults.payments = {
          data: null,
          error: null,
          insertResult: { data: { id: "pay-sim-1" }, error: null },
        };
        await periodicPOST(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback({
            PeriodType: "M",
            PeriodAmount: "390",
            TradeAmt: "390",
            CustomField1: "ADMIN_SIM",
          }) as any,
        );
        await runAfterCallbacks();
      };

      it("⑤ 不開發票", async () => {
        await simRenew();
        expect(issueInvoiceCalls).toEqual([]);
      });

      it("⑥ 不寄任何信給客戶", async () => {
        await simRenew();
        expect(sendEmailCalls).toEqual([]);
      });

      it("⑦ 但 DB 照跑（這支工具的用途就是驗續期邏輯，不能整包 skip）", async () => {
        await simRenew();
        const users = updates.filter((u) => u.table === "users").map((u) => u.row);
        expect(users.find((r) => "plan" in r)).toBeDefined();
      });

      it("⑧ payment 要留下可辨識的模擬標記，且 invoice_status 必須是 null", async () => {
        await simRenew();
        const pay = inserts.find((i) => i.table === "payments")?.row as Record<string, unknown>;
        expect(pay).toBeDefined();
        expect((pay.raw_response as Record<string, unknown>)._admin_simulation).toBe(true);
        // ⚠️ 不可以自創字串：invoice_status 有 CHECK 限制，塞不在清單裡的值會讓整筆 insert 靜默失敗
        expect(pay.invoice_status).toBeNull();
      });

      it("⑨ 負向對照：沒帶旗標的真扣款，發票與信照發（不能連真的一起擋掉）", async () => {
        tableResults.payments = {
          data: null,
          error: null,
          insertResult: { data: { id: "pay-real-1" }, error: null },
        };
        await periodicPOST(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback({ PeriodType: "M", PeriodAmount: "390", TradeAmt: "390" }) as any,
        );
        await runAfterCallbacks();
        const pay = inserts.find((i) => i.table === "payments")?.row as Record<string, unknown>;
        expect(pay.invoice_status).toBe("pending");
        expect(issueInvoiceCalls.length).toBeGreaterThan(0);
        expect(sendEmailCalls.length).toBeGreaterThan(0);
      });
    });

    it("④ ⚠️保護既有行為：已取消的訂閱收到扣款通知，絕不可以被反轉成 active", async () => {
      tableResults.subscriptions = {
        data: { ...ACTIVE_SUB, status: "cancelled" },
        error: null,
      };
      const { users, subs } = await renew();
      expect(users.some((r) => r.plan || r.subscription_status === "active")).toBe(false);
      expect(subs.some((r) => r.status === "active")).toBe(false);
    });
  });
});
