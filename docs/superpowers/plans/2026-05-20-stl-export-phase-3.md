# STL 匯出優化 階段 3：3MF 格式匯出 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 執行前先用 superpowers:using-git-worktrees 開隔離工作區。

**Goal:** 新增 3MF 格式匯出——現代切片器（Bambu / Prusa / Cura）偏好的格式，內含單位（mm）、多物件、零件中文名，比 STL 資訊完整。

**Architecture:** 3MF 是 ZIP（OPC）容器。自寫零依賴的極簡 stored-zip 寫入器 `lib/export/zip-store.ts`（不裝 fflate——worktree 內 node_modules 是 symlink，裝套件有風險）。`lib/export/three-mf.ts` 負責把 three.js Group 序列化成 3MF XML 並打包。`three-d-export.ts` 加 `download3MF` 下載函式。既有匯出全不動。

**Tech Stack:** TypeScript、three.js（`BufferGeometry`、`Group`、`Mesh`、`Matrix4`）、自寫 ZIP/CRC32。測試比照專案慣例：`.test.ts` 用 `npx tsx` 跑 assert 腳本。

**前置：** spec `docs/superpowers/specs/2026-05-20-stl-export-optimization-design.md` 第 ⑤ 節；階段 1（`756a365`）、階段 2（`66fba7d`）已上線。

**對 spec 的刻意偏離：** spec ⑤ 寫「新增 fflate」。本計畫改為自寫 stored-zip 寫入器——3MF 不需壓縮即可被切片器讀取，自寫可零依賴、不動 worktree 的 symlink node_modules、不碰 npm/pnpm lockfile。3MF＝ZIP 容器的最終結果不變。

**鐵律：** 既有 `downloadSTL` / `downloadOBJ` / `downloadFlatLayoutSTL` 行為 100% 不變。3MF 是新增並存匯出。

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `lib/export/zip-store.ts` | 新增。`crc32` + `zipStore`（極簡 STORED zip 寫入器，零依賴）。 |
| `lib/export/zip-store.test.ts` | 新增。`npx tsx` 測試，用系統 `unzip` 驗證。 |
| `lib/export/three-mf.ts` | 新增。`groupToModelXml`（Group → 3MF XML）+ `buildThreeMfZip`（打包成 3MF）。 |
| `lib/export/three-mf.test.ts` | 新增。`npx tsx` 測試。 |
| `lib/export/three-d-export.ts` | 修改。新增 `download3MF`。 |
| `components/ThreeDExportButton.tsx` | 修改。加「📦 3MF」按鈕。 |

---

## Task 1：極簡 ZIP 寫入器 `zip-store.ts`

**Files:**
- Create: `lib/export/zip-store.ts`
- Test: `lib/export/zip-store.test.ts`

- [ ] **Step 1: 寫 failing test**

建立 `lib/export/zip-store.test.ts`：
```ts
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
// unzip -t 驗證整體完整性（CRC 對）
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
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx tsx lib/export/zip-store.test.ts`
Expected: FAIL — cannot find module './zip-store'。

- [ ] **Step 3: 建立 `zip-store.ts`**

建立 `lib/export/zip-store.ts`：
```ts
/**
 * 極簡 STORED（不壓縮）ZIP 寫入器——零依賴。
 * 3MF 是 ZIP 容器，不需壓縮即可被切片器讀取；只需正確的 CRC32 與目錄結構。
 */

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

/** 標準 CRC-32（ZIP 用）。 */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/**
 * 把多個檔案打包成一個 STORED ZIP（Uint8Array）。
 * key = 檔案路徑（可含 `/` 子目錄），value = 檔案位元組。
 */
export function zipStore(files: Record<string, Uint8Array>): Uint8Array {
  const entries: Array<{
    nameBytes: Uint8Array;
    data: Uint8Array;
    crc: number;
    offset: number;
  }> = [];
  const localChunks: Uint8Array[] = [];
  let offset = 0;

  for (const [name, data] of Object.entries(files)) {
    const nameBytes = utf8(name);
    const crc = crc32(data);
    const header = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true); // local file header signature
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // compression = stored
    dv.setUint16(10, 0, true); // mod time
    dv.setUint16(12, 0, true); // mod date
    dv.setUint32(14, crc, true); // crc32
    dv.setUint32(18, data.length, true); // compressed size
    dv.setUint32(22, data.length, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true); // filename length
    dv.setUint16(28, 0, true); // extra length
    header.set(nameBytes, 30);
    entries.push({ nameBytes, data, crc, offset });
    localChunks.push(header, data);
    offset += header.length + data.length;
  }

  const cdStart = offset;
  const cdChunks: Uint8Array[] = [];
  for (const e of entries) {
    const cd = new Uint8Array(46 + e.nameBytes.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0, 0x02014b50, true); // central directory signature
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0, true); // flags
    dv.setUint16(10, 0, true); // compression
    dv.setUint16(12, 0, true); // mod time
    dv.setUint16(14, 0, true); // mod date
    dv.setUint32(16, e.crc, true); // crc32
    dv.setUint32(20, e.data.length, true); // compressed size
    dv.setUint32(24, e.data.length, true); // uncompressed size
    dv.setUint16(28, e.nameBytes.length, true); // filename length
    dv.setUint16(30, 0, true); // extra length
    dv.setUint16(32, 0, true); // comment length
    dv.setUint16(34, 0, true); // disk number start
    dv.setUint16(36, 0, true); // internal attrs
    dv.setUint32(38, 0, true); // external attrs
    dv.setUint32(42, e.offset, true); // local header offset
    cd.set(e.nameBytes, 46);
    cdChunks.push(cd);
    offset += cd.length;
  }
  const cdSize = offset - cdStart;

  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true); // end of central directory signature
  edv.setUint16(4, 0, true); // disk number
  edv.setUint16(6, 0, true); // disk with central directory
  edv.setUint16(8, entries.length, true); // entries on this disk
  edv.setUint16(10, entries.length, true); // total entries
  edv.setUint32(12, cdSize, true); // central directory size
  edv.setUint32(16, cdStart, true); // central directory offset
  edv.setUint16(20, 0, true); // comment length

  const all = [...localChunks, ...cdChunks, eocd];
  const total = all.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx tsx lib/export/zip-store.test.ts`
Expected: PASS — 5 個 check 全綠、印「全部通過」。

- [ ] **Step 5: Commit**

```bash
git add lib/export/zip-store.ts lib/export/zip-store.test.ts
git commit -m "feat(export): 零依賴極簡 STORED zip 寫入器（3MF 容器用）"
```

---

## Task 2：3MF XML 序列化 `groupToModelXml`

**Files:**
- Create: `lib/export/three-mf.ts`
- Test: `lib/export/three-mf.test.ts`

- [ ] **Step 1: 寫 failing test**

建立 `lib/export/three-mf.test.ts`：
```ts
/**
 * lib/export/three-mf.ts 驗證腳本
 * 跑法：npx tsx lib/export/three-mf.test.ts
 */
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { groupToModelXml } from "./three-mf";

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failed++;
  }
}

// --- groupToModelXml ---
const g = new Group();
const m = new Mesh(new BoxGeometry(10, 20, 30), new MeshBasicMaterial());
m.name = "測試板";
g.add(m);
const xml = groupToModelXml(g);

check("含 XML 宣告", xml.startsWith("<?xml"));
check("model unit=millimeter", xml.includes('unit="millimeter"'));
check("object 帶零件中文名", xml.includes('name="測試板"'));
check("BoxGeometry → 24 個 vertex", (xml.match(/<vertex /g) ?? []).length === 24);
check("BoxGeometry → 12 個 triangle", (xml.match(/<triangle /g) ?? []).length === 12);
check("含 build / item", xml.includes("<build>") && xml.includes("<item "));

// XML 跳脫：名稱含 & < 要跳脫
const g2 = new Group();
const m2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
m2.name = 'A&B<C>';
g2.add(m2);
const xml2 = groupToModelXml(g2);
check("零件名 XML 跳脫", xml2.includes("A&amp;B&lt;C&gt;") && !xml2.includes("A&B<C>"));

if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx tsx lib/export/three-mf.test.ts`
Expected: FAIL — cannot find module './three-mf'。

- [ ] **Step 3: 建立 `three-mf.ts` 並實作 `groupToModelXml`**

建立 `lib/export/three-mf.ts`：
```ts
import { BufferGeometry, Group, Mesh } from "three";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 座標格式化：固定小數、避免科學記號。 */
function fmt(n: number): string {
  return n.toFixed(4);
}

/**
 * 把一個已組好的 three.js Group 序列化成 3MF 的 `3D/3dmodel.model` XML。
 * 每個 mesh → 一個 <object>（帶零件中文名），世界座標已 bake 進頂點，
 * <item> 用單位矩陣。單位 millimeter。
 */
export function groupToModelXml(group: Group): string {
  group.updateMatrixWorld(true);
  const objects: string[] = [];
  const items: string[] = [];
  let id = 0;

  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    id++;
    // clone 幾何並 bake 世界矩陣 → 頂點直接是世界座標、item 用單位矩陣
    const geom = (mesh.geometry as BufferGeometry).clone();
    geom.applyMatrix4(mesh.matrixWorld);
    const pos = geom.getAttribute("position");
    const index = geom.getIndex();

    const verts: string[] = [];
    for (let i = 0; i < pos.count; i++) {
      verts.push(
        `<vertex x="${fmt(pos.getX(i))}" y="${fmt(pos.getY(i))}" z="${fmt(pos.getZ(i))}"/>`,
      );
    }
    const tris: string[] = [];
    const triCount = index ? index.count / 3 : pos.count / 3;
    for (let t = 0; t < triCount; t++) {
      const a = index ? index.getX(t * 3) : t * 3;
      const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      tris.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
    }
    geom.dispose();

    objects.push(
      `<object id="${id}" type="model" name="${xmlEscape(mesh.name || `part-${id}`)}">` +
        `<mesh><vertices>${verts.join("")}</vertices>` +
        `<triangles>${tris.join("")}</triangles></mesh></object>`,
    );
    items.push(`<item objectid="${id}"/>`);
  });

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<resources>${objects.join("")}</resources>` +
    `<build>${items.join("")}</build></model>`
  );
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx tsx lib/export/three-mf.test.ts`
Expected: PASS — 7 個 check 全綠。

- [ ] **Step 5: Commit**

```bash
git add lib/export/three-mf.ts lib/export/three-mf.test.ts
git commit -m "feat(export): groupToModelXml — three.js Group 序列化成 3MF XML"
```

---

## Task 3：3MF 打包 `buildThreeMfZip`

**Files:**
- Modify: `lib/export/three-mf.ts`
- Test: `lib/export/three-mf.test.ts`

- [ ] **Step 1: 加 failing test**

在 `three-mf.test.ts` 的 import 區，把：
```ts
import { groupToModelXml } from "./three-mf";
```
改成：
```ts
import { groupToModelXml, buildThreeMfZip } from "./three-mf";
import { mkdtempSync, writeFileSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
```

在 `// --- 收尾 ---` 沒有的話就在 `if (failed > 0)` **之前**插入：
```ts
// --- buildThreeMfZip ---
const mf = buildThreeMfZip("<model>test</model>");
check("3MF 以 PK 開頭", mf[0] === 0x50 && mf[1] === 0x4b);

const dir = mkdtempSync(join(tmpdir(), "threemf-"));
writeFileSync(join(dir, "m.3mf"), mf);
execSync(`unzip -o m.3mf`, { cwd: dir, stdio: "pipe" });
check(
  "3MF 含 [Content_Types].xml",
  readFileSync(join(dir, "[Content_Types].xml"), "utf8").includes("3dmodel"),
);
check(
  "3MF 含 _rels/.rels",
  readFileSync(join(dir, "_rels/.rels"), "utf8").includes("Relationship"),
);
check(
  "3MF 含 3D/3dmodel.model 且為傳入的 XML",
  readFileSync(join(dir, "3D/3dmodel.model"), "utf8") === "<model>test</model>",
);
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx tsx lib/export/three-mf.test.ts`
Expected: FAIL — `buildThreeMfZip` 尚未 export。

- [ ] **Step 3: 在 `three-mf.ts` 實作 `buildThreeMfZip`**

在 `three-mf.ts` 檔頭 import 加：
```ts
import { zipStore } from "./zip-store";
```

在 `three-mf.ts` 檔尾追加：
```ts
const CONTENT_TYPES_XML =
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
  `</Types>`;

const RELS_XML =
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Target="/3D/3dmodel.model" Id="rel0" ` +
  `Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
  `</Relationships>`;

/**
 * 把 3dmodel.model XML 打包成完整 3MF（OPC ZIP）位元組。
 */
export function buildThreeMfZip(modelXml: string): Uint8Array {
  const enc = new TextEncoder();
  return zipStore({
    "[Content_Types].xml": enc.encode(CONTENT_TYPES_XML),
    "_rels/.rels": enc.encode(RELS_XML),
    "3D/3dmodel.model": enc.encode(modelXml),
  });
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx tsx lib/export/three-mf.test.ts`
Expected: PASS — 11 個 check 全綠。

- [ ] **Step 5: Commit**

```bash
git add lib/export/three-mf.ts lib/export/three-mf.test.ts
git commit -m "feat(export): buildThreeMfZip — 打包成 3MF OPC 容器"
```

---

## Task 4：`download3MF` + UI 按鈕

**Files:**
- Modify: `lib/export/three-d-export.ts`
- Modify: `components/ThreeDExportButton.tsx`

- [ ] **Step 1: 在 `three-d-export.ts` 加 `download3MF`**

在 `three-d-export.ts` 既有 import 區加：
```ts
import { groupToModelXml, buildThreeMfZip } from "./three-mf";
```

在 `downloadOBJ` 函式**之後**插入：
```ts
/**
 * 匯出 3MF——切片器（Bambu / Prusa / Cura）偏好的格式，內含單位（mm）、
 * 多物件、零件中文名。組裝姿態。與 STL/OBJ 並存。
 */
export function download3MF(design: FurnitureDesign, scale: number = DEFAULT_SCALE) {
  const group = buildGroup(design, scale);
  warnIfInvalid(group);
  const xml = groupToModelXml(group);
  const zip = buildThreeMfZip(xml);
  const blob = new Blob([zip as BlobPart], { type: "model/3mf" });
  triggerDownload(blob, `${safeStem(design, scale)}.3mf`);
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "three-d-export|three-mf|zip-store" || echo "目標檔 0 error"`
Expected: `目標檔 0 error`
（若 `new Blob([zip])` 因 `Uint8Array` 型別報錯，已用 `zip as BlobPart` 處理；若仍報錯，改 `new Blob([zip.buffer as ArrayBuffer])`。）

- [ ] **Step 3: 在 `ThreeDExportButton.tsx` 加「📦 3MF」按鈕**

`components/ThreeDExportButton.tsx` 的 exporter import 改成（加 `download3MF`）：
```ts
import { downloadSTL, downloadOBJ, downloadFlatLayoutSTL, download3MF, validateDesignExport } from "@/lib/export/three-d-export";
```

找到「🛏️ 攤平 STL」`<button>`。在它的閉合 `</button>` **之後**、外層按鈕列 `</div>` **之前**，插入：
```tsx
        <button
          type="button"
          onClick={() => download3MF(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title="3MF — Bambu / Prusa / Cura 偏好格式，含單位與零件名"
        >
          📦 3MF
        </button>
```

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "ThreeDExportButton" || echo "目標檔 0 error"`
Expected: `目標檔 0 error`

- [ ] **Step 5: Commit**

```bash
git add lib/export/three-d-export.ts components/ThreeDExportButton.tsx
git commit -m "feat(export): 3MF 格式匯出 + 📦 3MF 按鈕"
```

---

## Task 5：階段 3 驗收 + 合併 main

**Files:** 無（驗證任務）

- [ ] **Step 1: 全量型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "lib/export|ThreeDExportButton" || echo "本階段檔案 0 error"`
Expected: `本階段檔案 0 error`

- [ ] **Step 2: 重跑全部單元測試**

Run: `npx tsx lib/export/zip-store.test.ts && npx tsx lib/export/three-mf.test.ts && npx tsx lib/export/flat-layout.test.ts && npx tsx lib/export/export-checks.test.ts`
Expected: 四支都印「全部通過」。

- [ ] **Step 3: 真家具 3MF 驗證**

把下列腳本存成 `scripts/_3mf-verify.ts`（臨時、不 commit），執行：
```ts
import { FURNITURE_CATALOG } from "../lib/templates";
import { buildGroup } from "../lib/export/three-d-export";
import { groupToModelXml, buildThreeMfZip } from "../lib/export/three-mf";
import { mkdtempSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import type { MaterialId } from "@/lib/types";

const entry = FURNITURE_CATALOG.find((e) => e.template);
if (!entry || !entry.template) throw new Error("無模板");
const opts = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
  (a, s) => { a[s.key] = s.defaultValue; return a; }, {});
const design = entry.template({
  length: entry.defaults.length, width: entry.defaults.width,
  height: entry.defaults.height, material: "maple" as MaterialId, options: opts,
});
const zip = buildThreeMfZip(groupToModelXml(buildGroup(design, 0.1)));
const dir = mkdtempSync(join(tmpdir(), "mf-"));
writeFileSync(join(dir, "m.3mf"), zip);
execSync(`unzip -t m.3mf`, { cwd: dir, stdio: "pipe" });
const list = execSync(`unzip -l m.3mf`, { cwd: dir }).toString();
const ok = list.includes("3D/3dmodel.model") && list.includes("[Content_Types].xml");
console.log(`${design.category} 3MF：unzip -t 通過、含必要檔 ${ok ? "✅" : "❌"}`);
process.exit(ok ? 0 : 1);
```
Run: `npx tsx scripts/_3mf-verify.ts`
Expected: 印出 `… 3MF：unzip -t 通過、含必要檔 ✅`。
（若 catalog API 與此不符，先 grep `scripts/audit-overlaps.ts` 比對正確用法——它已在跑全 catalog。驗收後此臨時腳本不要 `git add`。）

- [ ] **Step 4: 視覺驗證（playwright，best-effort）**

依專案記憶：Next 16 dev 若 middleware 卡住先 `mv middleware.ts middleware.ts.disabled`、完成還原；worktree 缺 `.env.local` 從主 repo 複製；dev server 用非預設 port。
1. 起 dev、開家具設計頁、找 3D 匯出列。
2. 確認「📦 3MF」按鈕在「🛏️ 攤平 STL」之後、可點。
3. 點「📦 3MF」→ 確認下載到 `<category>_<ratio>_<date>.3mf`。
4. 起不來就跳過、註明，靠 tsc + 單元測試 + Step 3。

- [ ] **Step 5: 收尾**

階段 3 完成。執行者依 superpowers:finishing-a-development-branch 把 worktree 分支合併回 `main` 並 push。

---

## Self-Review 紀錄

- **Spec coverage：** spec 第 ⑤ 節——3MF＝ZIP 容器（Task 1 `zipStore` + Task 3 `buildThreeMfZip`，含 `[Content_Types].xml`/`_rels/.rels`/`3D/3dmodel.model`）、`<model unit="millimeter">` 每零件一 `<object>` 含 `<vertices>`/`<triangles>` + `<build>`/`<item>`（Task 2 `groupToModelXml`）、零件中文名寫入 object `name`（Task 2，含 XML 跳脫）、UI「📦 3MF」按鈕（Task 4）。顏色：spec 註明「可第一版省略」——本計畫省略，只做單位＋名稱＋幾何。ZIP 函式庫：spec 說加 fflate，本計畫改自寫 stored-zip（見開頭「刻意偏離」說明，結果等價且零依賴）。
- **Placeholder scan：** 無 TBD；Task 4 Step 2 的 Blob 型別 fallback、Task 5 Step 3 的 catalog API fallback 屬「依現況校正」非 placeholder。
- **Type consistency：** `crc32`/`zipStore`/`groupToModelXml`/`buildThreeMfZip`/`download3MF` 跨 Task 命名一致；`download3MF(design, scale)` 與 `downloadSTL` 同簽名。

## 後續

階段 3 為本優化專案最後一階段。三階段全上線後 STL 匯出優化完成。
