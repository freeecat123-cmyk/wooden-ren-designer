/**
 * lib/export/zip-store.ts 驗證腳本
 * 跑法：npx tsx lib/export/zip-store.test.ts
 */
import { mkdtempSync, writeFileSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { crc32, zipStore } from "./zip-store";

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failed++;
  }
}

// crc32 標準測試向量："123456789" → 0xCBF43926
check(
  "crc32 標準測試向量",
  crc32(new TextEncoder().encode("123456789")) === 0xcbf43926,
);

// zipStore round-trip：用系統 unzip 解回來比對
const files: Record<string, Uint8Array> = {
  "hello.txt": new TextEncoder().encode("HELLO 木頭仁"),
  "3D/world.txt": new TextEncoder().encode("WORLD"),
};
const zip = zipStore(files);
check("zip 以 PK 魔術位元組開頭", zip[0] === 0x50 && zip[1] === 0x4b);

const dir = mkdtempSync(join(tmpdir(), "zipstore-"));
writeFileSync(join(dir, "t.zip"), zip);
execSync(`unzip -o t.zip`, { cwd: dir, stdio: "pipe" });
check(
  "解壓 hello.txt 內容正確",
  new TextDecoder().decode(readFileSync(join(dir, "hello.txt"))) ===
    "HELLO 木頭仁",
);
check(
  "解壓 3D/world.txt（含子目錄）內容正確",
  new TextDecoder().decode(readFileSync(join(dir, "3D/world.txt"))) === "WORLD",
);
let zipOk = true;
try {
  execSync(`unzip -t t.zip`, { cwd: dir, stdio: "pipe" });
} catch {
  zipOk = false;
}
check("unzip -t 完整性檢查通過（CRC 正確）", zipOk);

// 中文『檔名』round-trip：必設 UTF-8 flag(bit 11) + 檔名位元組能解回原字串
// （不走系統 unzip：macOS unzip 在 C locale 對 UTF-8 檔名會 Illegal byte sequence，
//  是 CLI locale 問題非 zip 問題；改行內解析 local header 驗證。）
const zhName = "P-01_椅腳.svg";
const zh = zipStore({ [zhName]: new TextEncoder().encode("<svg/>"), "leg.svg": new TextEncoder().encode("x") });
const dvZh = new DataView(zh.buffer, zh.byteOffset, zh.byteLength);
check("中文檔名 local header 設 UTF-8 flag (bit 11)", (dvZh.getUint16(6, true) & 0x0800) !== 0);
const nameLen = dvZh.getUint16(26, true); // local header filename length
const nameBytes = zh.subarray(30, 30 + nameLen);
check("中文檔名位元組以 UTF-8 解回原字串（非亂碼）", new TextDecoder("utf-8").decode(nameBytes) === zhName);

if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
