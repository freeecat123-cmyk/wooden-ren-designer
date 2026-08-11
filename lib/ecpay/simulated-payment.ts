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
