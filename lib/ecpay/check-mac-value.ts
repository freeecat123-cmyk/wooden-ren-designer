/**
 * 綠界 CheckMacValue 演算法 (SHA256, EncryptType=1)
 *
 * 演算法 (官方規格):
 *   1. 把參數依 key 字典序排列（不分大小寫）
 *   2. 串成 HashKey=xxx&Key1=Val1&Key2=Val2&...&HashIV=xxx
 *   3. 對整段做 .NET HttpUtility.UrlEncode 風格的編碼，全部轉小寫
 *   4. SHA256 雜湊
 *   5. 結果全部轉大寫即為 CheckMacValue
 *
 * .NET HttpUtility.UrlEncode 與 JS encodeURIComponent 的差異:
 *   - space:  .NET → "+",   JS → "%20"
 *   - "~":    .NET → "%7e", JS 不編碼
 *   - "'":    .NET → "%27", JS 不編碼
 *   - 其他 - _ . ! * ( ) 兩邊都不編碼
 */
import { createHash } from "node:crypto";

function urlEncodeEcpay(s: string): string {
  return encodeURIComponent(s)
    .replace(/%20/g, "+")
    .replace(/~/g, "%7e")
    .replace(/'/g, "%27")
    .toLowerCase();
}

export function calculateCheckMacValue(
  params: Record<string, string | number>,
  hashKey: string,
  hashIv: string,
): string {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== "CheckMacValue" && v !== undefined && v !== null)
    .sort(([a], [b]) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );

  let raw = `HashKey=${hashKey}`;
  for (const [k, v] of entries) raw += `&${k}=${v}`;
  raw += `&HashIV=${hashIv}`;

  const encoded = urlEncodeEcpay(raw);
  return createHash("sha256").update(encoded).digest("hex").toUpperCase();
}

export function verifyCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
): boolean {
  const received = params.CheckMacValue;
  if (!received) return false;
  const computed = calculateCheckMacValue(params, hashKey, hashIv);
  return received === computed;
}
