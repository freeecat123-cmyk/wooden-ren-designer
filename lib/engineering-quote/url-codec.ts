/**
 * 同構 base64url 編解碼,用於把模擬器 input 塞進 URL 參數。
 * client 用 btoa/atob、server 用 Buffer。
 */

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return b64 + pad;
}

export function encodeState(obj: unknown): string {
  const json = JSON.stringify(obj);
  if (typeof window === "undefined") {
    return toBase64Url(Buffer.from(json, "utf8").toString("base64"));
  }
  // 瀏覽器:先 UTF-8 編碼再 btoa
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return toBase64Url(btoa(bin));
}

export function decodeState<T>(s: string): T {
  const b64 = fromBase64Url(s);
  let json: string;
  if (typeof window === "undefined") {
    json = Buffer.from(b64, "base64").toString("utf8");
  } else {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    json = new TextDecoder().decode(bytes);
  }
  return JSON.parse(json) as T;
}
