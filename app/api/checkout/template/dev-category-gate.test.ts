/**
 * 「先不要上架」的範本（DEV_CATEGORIES）不准開結帳單。
 *
 * 🩸 2026-09-09：木頭仁說乙級「先不要上架」，cert-b1／cert-b2 進了 DEV_CATEGORIES，
 * /templates、/app、sitemap、定價頁、介紹頁七個 UI 入口全部擋乾淨了，
 * **但這支 API 從頭到尾沒問過 isDevCategory** —— 登入後手打一個 POST 帶 category=cert-b2
 * 就能對半成品開出真的綠界付款單（實測 cert-b1 290、cert-b2 299）。
 * 這條路 UI 蓋不到，只能在 API 擋，所以用測試釘死。
 *
 * dev-categories-single-source.test.ts 只守「名單有沒有被抄第二份」，守不到這裡。
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { DEV_CATEGORIES } from "@/lib/templates";
import { isPaidCategory } from "@/lib/permissions";

// config.ts 在 module 載入當下就把 env 讀成 const，所以要先塞好再 import route
vi.stubEnv("ECPAY_MERCHANT_ID", "2000132");
vi.stubEnv("ECPAY_HASH_KEY", "test-hash-key");
vi.stubEnv("ECPAY_HASH_IV", "test-hash-iv");

// 沒登入的訪客：閘門放行後才會走到這裡（正對照就是靠這個分辨「被擋」還是「通過」）
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  createAdminClient: () => {
    throw new Error("不該走到 admin client——訪客應該先被導去登入");
  },
}));

let POST: (req: Request) => Promise<Response>;
beforeAll(async () => {
  ({ POST } = (await import("./route")) as unknown as { POST: typeof POST });
});

/** 直接打這支 API（模擬有人繞過 UI 手送表單） */
async function post(category: string): Promise<Response> {
  const body = new FormData();
  body.set("category", category);
  return POST(new Request("https://designer.woodenren.com/api/checkout/template", { method: "POST", body }));
}

describe("結帳 API 擋開發中範本", () => {
  it("名單裡每一款付費範本都開不了單", async () => {
    const devPaid = [...DEV_CATEGORIES].filter((c) => isPaidCategory(c as never));
    expect(devPaid.length, "DEV_CATEGORIES 應該至少有一款付費範本可驗").toBeGreaterThan(0);
    for (const c of devPaid) {
      const res = await post(c);
      expect(res.status, c).toBe(400);
      expect((await res.json()).error, c).toBe("template-not-released");
    }
  });

  it("cert-b1／cert-b2 兩款乙級明確擋住（木頭仁 2026-09-09「先不要上架」）", async () => {
    for (const c of ["cert-b1", "cert-b2"]) {
      expect((await (await post(c)).json()).error, c).toBe("template-not-released");
    }
  });

  it("正對照：已上架的付費範本不會被這道閘擋掉（沒登入 → 導去 /login，代表已經通過）", async () => {
    // 這條是尺規校準：如果閘門寫成「全部擋掉」，這條會紅
    const res = await post("cert-c1");
    expect(res.status).toBe(303);                                   // 已經走到後面的登入檢查
    expect(res.headers.get("location")).toContain("/login");
  });

  it("找不到的 category 仍照舊回 category-not-found（閘門沒有蓋過既有錯誤）", async () => {
    const res = await post("no-such-template");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("category-not-found");
  });
});
