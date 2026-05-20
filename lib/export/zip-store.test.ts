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

if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
