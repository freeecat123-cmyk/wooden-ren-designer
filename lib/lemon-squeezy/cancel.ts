/**
 * 取消 Lemon Squeezy 訂閱(國際版走這條金流)。
 *
 * ⭐ 為什麼需要這支:`/api/cancel-subscription` 原本只認綠界。
 *   Lemon Squeezy 的訂閱沒有 `ecpay_merchant_trade_no`,那支 route 會走進
 *   「沒有 merchant_trade_no → 跳過金流商、只把資料庫標成 cancelled」這條分支,
 *   回報**取消成功**——但 Lemon Squeezy 那邊完全沒被通知,**照樣每個月扣款**。
 *   客戶看到「已取消」,信用卡繼續被扣,而且我們的資料庫顯示他已經取消。
 *   (2026-08-21 稽核發現。)
 *
 * LS 的 DELETE /v1/subscriptions/{id} 語意是「期末取消」(cancelled 但服務到 ends_at),
 * 跟綠界 Terminate + 本站「本期權限保留到到期日」的行為一致。
 */
import { lemonSqueezy, LemonSqueezyError } from "./client";

export type LsCancelResult = {
  ok: boolean;
  /** 這筆訂閱在 LS 那邊已經不是進行中(取消成功、或本來就已取消/不存在)。 */
  benign?: boolean;
  status?: number;
  detail?: string;
};

export async function cancelLemonSqueezySubscription(
  subscriptionId: string,
): Promise<LsCancelResult> {
  try {
    await lemonSqueezy.delete(`/subscriptions/${subscriptionId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof LemonSqueezyError) {
      /**
       * 404 = 這筆訂閱在 LS 已經不存在;422 通常是「已經取消過了」。
       * 兩者都代表「LS 那邊不會再扣款」,對使用者來說跟成功一樣,可以放行標記資料庫。
       * ⚠️ 其他錯誤(401 金鑰失效、5xx)一律當失敗——不可以標成已取消,
       *    否則就回到「畫面說取消了、卡繼續被扣」的原始問題。
       */
      const benign = e.status === 404 || e.status === 422;
      return { ok: benign, benign, status: e.status, detail: e.body?.slice(0, 300) };
    }
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
