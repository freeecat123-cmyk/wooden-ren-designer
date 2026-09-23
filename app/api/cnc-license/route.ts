/**
 * GET /api/cnc-license — 工具本體問「我現在還能不能產碼」
 *
 * ⭐ 這支存在的理由（不是多餘的第二道門）：
 *    CNC 工具是**完全離線**的單檔 HTML（零 fetch、雙擊即用）。/api/cnc-tool 只能
 *    決定「誰拿得到檔案」，一旦交出去，對方存下網頁就能永久使用。
 *    在只賣買斷、只有付過錢的人拿得到檔的年代這無所謂；改成 7 天免費試用之後，
 *    等於主動把完整可用的檔案交給每一個還沒付錢的人 —— 這支就是那個缺口的補丁。
 *
 * 工具用**相對路徑**呼叫這裡，所以：
 *   - 線上（designer.woodenren.com / cnc.woodenren.com 的 iframe）＝同源，帶得到 cookie
 *   - 存到本機的複本（file://）＝解析成 file:///api/cnc-license，必然失敗
 *   - 被搬到別的網站重架＝打到那個網站自己的 /api/cnc-license，必然失敗
 * 三種情況剛好就是我們要的結果。
 *
 * 一律回 200 + JSON（不用 401）：工具只需要分辨「能用／不能用」，
 * 用狀態碼分流會讓 client 端多一條容易寫錯的路徑。
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveCncAccess } from "@/lib/cnc/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 離線寬限時數。付費使用者的機台常在收訊差的工作室／工廠，
 * 網路斷一下就不能產碼是不能接受的（木頭仁自己就是這樣用）。
 * 由伺服器決定而不是寫死在工具裡：日後要調整不必重新 build 那份 1MB HTML。
 */
const GRACE_HOURS = 72;

export async function GET() {
  const noStore = { "Cache-Control": "private, no-store" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "anonymous" },
      { headers: noStore },
    );
  }

  const access = await resolveCncAccess(user);

  // ⭐查不到 ≠ 沒權限。回 503 而不是 { ok:false }，因為工具端對這兩者的處理天差地遠：
  //   { ok:false } 是**權威的拒絕** → 工具會清掉離線寬限快取並當場鎖住產碼；
  //   非 200 則被當成「連不到伺服器」→ 工具改用 72 小時寬限，付費客照常能工作。
  // 資料庫抽風一秒，不該讓工廠裡的買斷客永久失去他的離線寬限（那一步不可逆）。
  //
  // 注意這裡刻意不用 200 + 特殊 reason：工具是離線單檔 HTML，已經發出去的版本
  // 認不得新 reason，只認得 HTTP 狀態。用 503 連舊版工具都會走對分支。
  if (access.degraded) {
    return NextResponse.json(
      { reason: "unknown", checkedAt: new Date().toISOString() },
      { status: 503, headers: noStore },
    );
  }

  return NextResponse.json(
    {
      ok: access.allowed,
      reason: access.reason,
      /** 權限何時失效（null = 買斷／永久版／admin，不會失效） */
      expiresAt: access.expiresAt,
      daysLeft: access.daysLeft,
      /** 「個人版」「永久買斷」「免費試用」…工具直接顯示這串 */
      planLabel: access.planLabel,
      graceHours: GRACE_HOURS,
      checkedAt: new Date().toISOString(),
    },
    { headers: noStore },
  );
}
