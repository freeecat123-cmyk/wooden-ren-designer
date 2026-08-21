import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 🧷 Lemon Squeezy 取消訂閱。
 *
 * ⭐ 為什麼這支的每一條都重要:回傳 `ok` 會直接決定
 *   `/api/cancel-subscription` 要不要把資料庫標成 cancelled。
 *   判斷錯的後果是**畫面顯示已取消、信用卡繼續被扣**——而且對帳看不出來,
 *   因為我們自己的資料庫也顯示他取消了。這正是修好前每一筆 LS 訂閱的實際行為。
 */

let deleteCalls: string[];
let deleteImpl: (path: string) => Promise<unknown>;

class FakeLsError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`LS API ${status}`);
  }
}

vi.mock("./client", () => ({
  LemonSqueezyError: FakeLsError,
  lemonSqueezy: {
    delete: (path: string) => {
      deleteCalls.push(path);
      return deleteImpl(path);
    },
  },
}));

const { cancelLemonSqueezySubscription } = await import("./cancel");

beforeEach(() => {
  deleteCalls = [];
  deleteImpl = async () => ({ data: {} });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cancelLemonSqueezySubscription", () => {
  it("① 打對端點:DELETE /subscriptions/<id>", async () => {
    await cancelLemonSqueezySubscription("sub_123");
    expect(deleteCalls).toEqual(["/subscriptions/sub_123"]);
  });

  it("② 取消成功 → ok", async () => {
    const r = await cancelLemonSqueezySubscription("sub_123");
    expect(r.ok).toBe(true);
  });

  it("③ 404(LS 已經沒有這筆)→ 視為成功:那邊不會再扣款了", async () => {
    deleteImpl = async () => {
      throw new FakeLsError(404, "not found");
    };
    const r = await cancelLemonSqueezySubscription("sub_123");
    expect(r.ok).toBe(true);
    expect(r.benign).toBe(true);
  });

  it("④ 422(已經取消過)→ 視為成功", async () => {
    deleteImpl = async () => {
      throw new FakeLsError(422, "already cancelled");
    };
    expect((await cancelLemonSqueezySubscription("sub_123")).ok).toBe(true);
  });

  it("⑤ ⛔金鑰失效(401)→ 必須是失敗。標成已取消會讓客戶被繼續扣款", async () => {
    deleteImpl = async () => {
      throw new FakeLsError(401, "unauthenticated");
    };
    const r = await cancelLemonSqueezySubscription("sub_123");
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  it("⑥ ⛔LS 掛掉(500)→ 必須是失敗", async () => {
    deleteImpl = async () => {
      throw new FakeLsError(500, "boom");
    };
    expect((await cancelLemonSqueezySubscription("sub_123")).ok).toBe(false);
  });

  it("⑦ 連線層直接爆掉(不是 LS 回的錯誤)→ 也要是失敗,不能當成成功", async () => {
    deleteImpl = async () => {
      throw new TypeError("fetch failed");
    };
    const r = await cancelLemonSqueezySubscription("sub_123");
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("fetch failed");
  });
});
