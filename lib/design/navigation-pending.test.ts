import { describe, expect, it } from "vitest";
import { designSearchKey } from "./navigation-pending";

describe("designSearchKey", () => {
  it("排序後比對，順序不同視為同一個鍵", () => {
    expect(designSearchKey("b=2&a=1")).toBe(designSearchKey("a=1&b=2"));
  });

  it("⭐ 空值參數要丟掉 —— Next 的 server searchParams 就是這樣處理的", () => {
    // 正式站實測：網址 ?joineryMode=&length=350 到 server 手上只剩 length=350
    expect(designSearchKey("joineryMode=&length=350")).toBe(designSearchKey("length=350"));
  });

  it("⭐ 回歸：組裝版 radio 推出去的 joineryMode= 不可以讓 client / server 兩邊對不起來", () => {
    const clientPushed = "joineryMode=&length=350&width=350&legSize=38";
    const serverResolved = "length=350&width=350&legSize=38"; // Next 丟掉空值後 server 收到的
    expect(designSearchKey(clientPushed)).toBe(designSearchKey(serverResolved));
  });

  it("多個空值參數一起丟，不會因為邊迭代邊刪而漏掉", () => {
    expect(designSearchKey("a=&b=&c=3&d=")).toBe("c=3");
  });

  it("非空的值一律保留 —— joineryMode=true 不能被當成空的丟掉", () => {
    expect(designSearchKey("joineryMode=true&length=350")).toBe("joineryMode=true&length=350");
    expect(designSearchKey("a=0&b=false")).toBe("a=0&b=false");
  });

  it("真的不同的設計不可以被視為同一個鍵", () => {
    expect(designSearchKey("length=350")).not.toBe(designSearchKey("length=400"));
    expect(designSearchKey("joineryMode=true&length=350")).not.toBe(designSearchKey("length=350"));
  });
});
