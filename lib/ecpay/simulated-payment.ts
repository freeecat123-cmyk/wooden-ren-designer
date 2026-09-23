/**
 * 綠界「模擬付款」判定。
 *
 * 綠界廠商後台可以對一筆訂單按「模擬付款」來測試 ReturnURL 有沒有接通。
 * 這時候送過來的回呼**跟真的付款成功長得一模一樣**（RtnCode 同樣是 1），
 * 唯一的差別就是多帶一個 SimulatePaid=1。官方文件原文：
 *
 *   「此交易為模擬付款，RtnCode 也為 1。並非是由消費者實際真的付款，
 *     所以綠界也不會撥款給廠商，請勿對該筆交易做出貨等動作，以避免損失。」
 *
 * 對這個站來說「出貨」有三件事，每一件都不可逆：
 *   1. 寫 tool_unlocks / template_unlocks —— 永久買斷，寫下去就是免費送
 *   2. 把 subscription / users.plan 打成 active
 *   3. 開立綠界 B2C 電子發票 —— 最要命，開出去的是財政部認得的真號碼
 *      （線上字軌已經在跑 DQ／BS），錢卻永遠不會進來，差額等於短漏開，
 *      事後只能再跑作廢或折讓去補。
 *
 * 所以凡是「把 RtnCode=1 當成付款成功」的入口，都必須先問過這裡。
 *
 * 寬鬆解析（trim + 轉字串）而不是 === "1"：這個值是從 form-data 撈出來的，
 * 不值得為了空白字元讓一筆真的模擬付款漏過閘門。
 */
export function isSimulatedPayment(params: Record<string, string>): boolean {
  return String(params.SimulatePaid ?? "").trim() === "1";
}

/**
 * admin 後台「模擬月扣」用的旗標,放在 CustomField1。
 *
 * 跟上面綠界自己的 SimulatePaid 是**不同的東西**,差別在「該做到哪裡為止」:
 *
 * | 來源 | DB 要不要動 | 開發票 / 寄信 |
 * |---|---|---|
 * | 綠界後台模擬付款 `SimulatePaid=1` | ❌ 什麼都不做 | ❌ |
 * | admin 後台「模擬月扣」 `CustomField1=ADMIN_SIM` | ✅ 照跑(這正是要測的) | ❌ |
 * | 真的扣款 | ✅ | ✅ |
 *
 * ⭐ 中間那格就是這個常數存在的理由:admin 這支工具的用途是**驗證續期邏輯**,
 *   所以 DB 更新一定要真的跑;但它送的是一筆不存在的錢,發票與通知信絕對不能發出去。
 *   在此之前這支工具送的回呼跟真回呼無法區分 → 會對真實客戶開出真號碼的電子發票
 *   並寄「扣款成功」信,帳上還多一筆永遠不會入帳的營收。(2026-08-21 稽核發現;
 *   查過正式站 93 筆 payments,這顆鈕從來沒被按過,屬於還沒踩到的地雷。)
 *
 * 放 CustomField1 的理由:它會被算進 CheckMacValue,沒有 HashKey 就偽造不了;
 * 而真實綠界回呼這一欄一律是空字串(已核對正式站 raw_response)。
 */
export const ADMIN_SIMULATION_FLAG = "ADMIN_SIM";

/** 這筆回呼是不是 admin 後台按「模擬月扣」打出來的(必須已通過 CheckMacValue 驗簽才可信)。 */
export function isAdminSimulation(params: Record<string, string>): boolean {
  return String(params.CustomField1 ?? "").trim() === ADMIN_SIMULATION_FLAG;
}
