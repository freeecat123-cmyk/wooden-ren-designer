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
