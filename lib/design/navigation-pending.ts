/**
 * 「設計參數導航是否還在路上」的比對用鍵。
 *
 * client 端每次推 URL 都 announce 一次目標鍵；server 重新 render 後把自己收到的
 * searchParams 也轉成同一種鍵（`StudioActionGuard` 的 `resolvedSearch`）。
 * 兩邊相等 = server 已經追上，匯出/儲存才放行（見 `StudioActionGuard`）。
 *
 * ⚠️ **空值參數一定要丟掉**（2026-09-09 修）。
 *
 * Next.js 的 server `searchParams` **會把值為空字串的參數整個丟掉**：
 * 網址 `?joineryMode=&length=350` 到 server 手上只剩 `length=350`
 * （已在正式站實測：`joineryMode=` 被丟、`joineryMode=true` 保留、
 * 隨便塞一個 `emptyProbe=` 也被丟）。
 *
 * 而設計表單的「組裝版 / 榫接版」是一組 radio，組裝版那顆的 value 就是空字串，
 * 所以表單每次推 URL 都會帶一個 `joineryMode=`。
 * 結果：client 宣告的鍵永遠比 server 的多一個 key → 兩邊**永遠不相等** →
 * `navigationPending` 卡在 true → StudioActionGuard 把每一次
 * 「材料單 / 裁切計算器 / 列印 / 報價 / 儲存」的點擊都 preventDefault。
 *
 * 使用者看到的症狀就是「改完參數以後，按鈕點了完全沒反應」（只有頂端一條
 * 不顯眼的「請先完成參數更新」提示）。**改一次參數就中，而且不會自己好，
 * 要重新整理才恢復。**
 *
 * 空值在 server 眼中本來就等同「沒有這個參數」，所以兩邊都丟掉才是同一套規則。
 * 這個鍵只用來比對「server 追上了沒」，不參與導航，丟掉不影響任何行為。
 */
export function designSearchKey(search: string) {
  const query = new URLSearchParams(search);
  // 先收集再刪：直接在迭代中 delete 會跳過元素
  const blanks: string[] = [];
  query.forEach((value, key) => {
    if (value === "") blanks.push(key);
  });
  for (const key of blanks) query.delete(key);
  query.sort();
  return query.toString();
}

export function announceDesignNavigation(href: string) {
  if (typeof window === "undefined") return;
  const target = new URL(href, window.location.href);
  window.dispatchEvent(new CustomEvent("wooden-ren:design-navigation", {
    detail: { search: designSearchKey(target.search) },
  }));
}
