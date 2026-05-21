/** 跑法:npx tsx lib/engineering-quote/url-codec.test.ts */
import { encodeState, decodeState } from "./url-codec";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}

// 1. round-trip 物件
{
  const obj = { a: 1, b: "中文", c: [1, 2, 3], d: { x: true } };
  const enc = encodeState(obj);
  const dec = decodeState<typeof obj>(enc);
  assert(JSON.stringify(dec) === JSON.stringify(obj), "round-trip 一致");
}

// 1b. 空物件 round-trip
{
  const enc = encodeState({});
  assert(JSON.stringify(decodeState(enc)) === "{}", "空物件 round-trip");
}

// 2. 編碼字串 URL-safe(無 + / =)
{
  const enc = encodeState({ room: "x".repeat(200) });
  assert(!/[+/=]/.test(enc), `URL-safe: ${enc.slice(0, 20)}...`);
}

// 3. 壞字串 decode 丟錯
{
  let threw = false;
  try {
    decodeState("!!!not-base64!!!");
  } catch {
    threw = true;
  }
  assert(threw, "壞輸入 decode 丟錯");
}

console.log(`✅ url-codec: ${passed} passed`);
