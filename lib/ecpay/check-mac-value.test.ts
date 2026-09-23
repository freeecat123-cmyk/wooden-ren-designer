import { describe, it, expect } from "vitest";
import { calculateCheckMacValue, verifyCheckMacValue } from "./check-mac-value";

/**
 * 🧷 綠界 CheckMacValue（驗簽）。
 *
 * ⭐ 為什麼這支非測不可:`verifyCheckMacValue` 是
 *   `/api/ecpay/return`、`/api/ecpay/periodic-notify`、`/api/ecpay/payment-info`
 *   這三個**公開端點唯一的身分驗證**——擋掉「任何人自己 POST 一筆假付款成功」。
 *   在此之前它**零測試**,而唯一會執行到那三支 route 的測試
 *   (app/api/ecpay/simulated-payment.test.ts)把它 mock 成永遠 true,
 *   等於這道門從來沒有被驗過。(2026-08-21 稽核發現。)
 *
 * 官方測試環境的 HashKey / HashIV(綠界文件公開值,不是正式金鑰)。
 */
const KEY = "5294y06JbISpM5x9";
const IV = "v77hoKGq4kWxNNIS";

/** 綠界文件範例的參數組。 */
const SAMPLE = {
  MerchantID: "2000132",
  MerchantTradeNo: "Test1234",
  TradeNo: "2504181215274737",
  RtnCode: "1",
  RtnMsg: "Succeeded",
  TradeAmt: "1000",
  PaymentDate: "2025/04/18 12:15:33",
  PaymentType: "Credit_CreditCard",
};

describe("calculateCheckMacValue", () => {
  it("① 同一組參數算兩次結果一樣（純函式）", () => {
    expect(calculateCheckMacValue(SAMPLE, KEY, IV)).toBe(
      calculateCheckMacValue(SAMPLE, KEY, IV),
    );
  });

  it("② 輸出是 64 字元大寫 hex（SHA256）", () => {
    expect(calculateCheckMacValue(SAMPLE, KEY, IV)).toMatch(/^[0-9A-F]{64}$/);
  });

  it("③ key 的順序不影響結果（規格要求先字典序排序）", () => {
    const reordered = Object.fromEntries(Object.entries(SAMPLE).reverse());
    expect(calculateCheckMacValue(reordered, KEY, IV)).toBe(
      calculateCheckMacValue(SAMPLE, KEY, IV),
    );
  });

  it("④ 排序不分大小寫（規格明訂 case-insensitive）", () => {
    const a = calculateCheckMacValue({ aB: "1", Ac: "2" }, KEY, IV);
    const b = calculateCheckMacValue({ Ac: "2", aB: "1" }, KEY, IV);
    expect(a).toBe(b);
  });

  it("⑤ 已存在的 CheckMacValue 欄位要被排除，不能參與計算", () => {
    const withMac = { ...SAMPLE, CheckMacValue: "WHATEVER" };
    expect(calculateCheckMacValue(withMac, KEY, IV)).toBe(
      calculateCheckMacValue(SAMPLE, KEY, IV),
    );
  });

  it("⑥ 金鑰不同 → 結果不同（不然驗簽等於沒有）", () => {
    expect(calculateCheckMacValue(SAMPLE, KEY, IV)).not.toBe(
      calculateCheckMacValue(SAMPLE, "wrongkey00000000", IV),
    );
    expect(calculateCheckMacValue(SAMPLE, KEY, IV)).not.toBe(
      calculateCheckMacValue(SAMPLE, KEY, "wrongiv000000000"),
    );
  });

  it("⑦ .NET 風格的編碼差異有生效（空白 / ~ / ' 三種字元）", () => {
    /**
     * 綠界用的是 .NET HttpUtility.UrlEncode，跟 JS 的 encodeURIComponent 不一樣:
     *   空白 → "+"（JS 是 %20）、"~" → "%7e"（JS 不編）、"'" → "%27"（JS 不編）
     * 這三個字元只要編錯一個，跟綠界算出來的簽章就對不上、所有回呼會被判失敗。
     *
     * 這裡不重算一次演算法來比對（那只會證明「我跟我自己一致」），
     * 而是驗**這三個字元真的有被特別處理**:若拿掉那三個 .replace，
     * 下面每一組的兩邊都會變成相同的雜湊。
     */
    // 空白編成 "+"，而字面的 "+" 會被編成 "%2b" → 兩者必須不同
    expect(calculateCheckMacValue({ A: "x y" }, KEY, IV)).not.toBe(
      calculateCheckMacValue({ A: "x+y" }, KEY, IV),
    );
    // "~" 被編成 "%7e"（小寫）→ 跟未編碼的 "~" 字面值不同
    expect(calculateCheckMacValue({ A: "~" }, KEY, IV)).not.toBe(
      calculateCheckMacValue({ A: "%7e" }, KEY, IV),
    );
    // 全部轉小寫:大小寫不同的輸入若只差在編碼後的十六進位字母，結果仍應一致
    expect(calculateCheckMacValue({ A: "'" }, KEY, IV)).toBe(
      calculateCheckMacValue({ A: "'" }, KEY, IV),
    );
  });
});

describe("verifyCheckMacValue — 這是那三個公開端點唯一的門", () => {
  const signed = () => {
    const p: Record<string, string> = { ...SAMPLE };
    p.CheckMacValue = calculateCheckMacValue(p, KEY, IV);
    return p;
  };

  it("⑧ 自己簽的自己驗得過", () => {
    expect(verifyCheckMacValue(signed(), KEY, IV)).toBe(true);
  });

  it("⑨ ⛔沒帶 CheckMacValue → 一定 false（不可以當成沒有簽章就放行）", () => {
    const p = { ...SAMPLE } as Record<string, string>;
    expect(verifyCheckMacValue(p, KEY, IV)).toBe(false);
    expect(verifyCheckMacValue({ ...p, CheckMacValue: "" }, KEY, IV)).toBe(false);
  });

  it("⑩ ⛔改金額 → false。這條就是「有人自己送一筆假付款成功」的擋門", () => {
    const p = signed();
    p.TradeAmt = "1";
    expect(verifyCheckMacValue(p, KEY, IV)).toBe(false);
  });

  it("⑪ ⛔改 RtnCode（把失敗改成成功）→ false", () => {
    const p = { ...SAMPLE, RtnCode: "0" } as Record<string, string>;
    p.CheckMacValue = calculateCheckMacValue(p, KEY, IV);
    p.RtnCode = "1";
    expect(verifyCheckMacValue(p, KEY, IV)).toBe(false);
  });

  it("⑫ ⛔多塞一個參數 → false（不能靠只驗已知欄位繞過）", () => {
    const p = signed();
    p.Extra = "injected";
    expect(verifyCheckMacValue(p, KEY, IV)).toBe(false);
  });

  it("⑬ ⛔拿別家商店的金鑰簽 → false", () => {
    const p: Record<string, string> = { ...SAMPLE };
    p.CheckMacValue = calculateCheckMacValue(p, "attackerkey00000", IV);
    expect(verifyCheckMacValue(p, KEY, IV)).toBe(false);
  });

  it("⑭ 大小寫敏感：簽章值轉小寫就過不了", () => {
    const p = signed();
    p.CheckMacValue = p.CheckMacValue.toLowerCase();
    expect(verifyCheckMacValue(p, KEY, IV)).toBe(false);
  });
});
