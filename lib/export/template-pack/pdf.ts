// SVG 字串 → PDF。用 jsPDF + svg2pdf.js，紙張尺寸精準到 mm。
// 兩個實測踩過的坑寫在下面，改動前先讀。

/**
 * 找出 svg 字串裡每一個 <text ...> 到其「對應」的 </text> 之間的區段（原始字串，未去標籤）。
 *
 * 不用一次到位的 regex 硬解巢狀標籤 —— <text>abc<tspan>def</tspan>ghi</text> 這種案例，
 * 非貪婪 regex 撞到第一個 </tspan> 就會誤判成 <text> 的收尾，把 ghi 漏掉。
 * 改成手動追蹤 <text>/</text> 的巢狀深度找到「真正對應」的收尾，中間不管有幾層 <tspan> 都算進區段內，
 * 之後統一用 replace(/<[^>]*>/g, "") 把區段內所有標籤（含 tspan）剝掉即可。
 */
function extractTextBlocks(svg: string): string[] {
  const blocks: string[] = [];
  const openTag = /<text\b[^>]*>/g;
  let om: RegExpExecArray | null;
  while ((om = openTag.exec(svg))) {
    const contentStart = om.index + om[0].length;
    const tagRe = /<\/?text\b[^>]*>/g;
    tagRe.lastIndex = contentStart;
    let depth = 1;
    let contentEnd = svg.length;
    let afterClose = svg.length;
    let tm: RegExpExecArray | null;
    while ((tm = tagRe.exec(svg))) {
      if (tm[0].startsWith("</")) {
        depth--;
        if (depth === 0) {
          contentEnd = tm.index;
          afterClose = tm.index + tm[0].length;
          break;
        }
      } else {
        depth++;
      }
    }
    blocks.push(svg.slice(contentStart, contentEnd));
    openTag.lastIndex = afterClose;
  }
  return blocks;
}

/** 把 sheet.ts 的 esc() 轉出的 XML 實體解回原字元。&amp; 一定要放最後，否則其他實體裡的 & 會被誤解碼。 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 從 SVG 字串抽出所有 <text>（含巢狀 <tspan>）的文字內容字元，XML 實體解碼回原字元，去重。 */
export function collectChars(svgs: string[]): string {
  const set = new Set<string>();
  for (const svg of svgs) {
    for (const block of extractTextBlocks(svg)) {
      const plain = decodeXmlEntities(block.replace(/<[^>]*>/g, ""));
      for (const ch of plain) set.add(ch);
    }
  }
  return Array.from(set).join("");
}

/** 向伺服器要這批 SVG 用得到的字型子集，回 base64。 */
export async function fetchFontSubset(svgs: string[]): Promise<string> {
  const res = await fetch("/api/pdf-font", {
    method: "POST",
    body: JSON.stringify({ chars: collectChars(svgs) }),
  });
  if (!res.ok) throw new Error(`字型子集失敗：${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

/**
 * 同一種紙張的多張 SVG → 一份多頁 PDF。
 *
 * ⚠️ 隱藏容器必須用 left:-99999px，不可用 display:none ——
 *    svg2pdf 依賴 getBBox()，元素沒有參與版面時回傳 0，整張圖會崩掉。
 * ⚠️ SVG 內的 font-family 必須是 "PackCJK"（sheet.ts 已這樣寫），
 *    否則 svg2pdf 會去找 helvetica，中文變亂碼。
 * ⚠️ 目前只有 Noto Sans TC Regular 一種粗細，normal / bold 都註冊同一支字型檔——
 *    700 的字不會亂碼，只是不會真的變粗（刻意接受，見 task-6-brief）。
 */
export async function svgsToPdf(
  svgs: string[],
  pageWmm: number,
  pageHmm: number,
  fontB64: string,
): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const { svg2pdf } = await import("svg2pdf.js");

  const doc = new jsPDF({
    unit: "mm",
    format: [pageWmm, pageHmm],
    orientation: pageWmm >= pageHmm ? "landscape" : "portrait",
  });
  doc.addFileToVFS("PackCJK.ttf", fontB64);
  doc.addFont("PackCJK.ttf", "PackCJK", "normal");
  doc.addFont("PackCJK.ttf", "PackCJK", "bold");
  doc.setFont("PackCJK");

  const box = document.createElement("div");
  box.style.cssText = "position:absolute;left:-99999px;top:0";
  document.body.appendChild(box);
  try {
    for (let i = 0; i < svgs.length; i++) {
      if (i > 0) doc.addPage([pageWmm, pageHmm], pageWmm >= pageHmm ? "landscape" : "portrait");
      box.innerHTML = svgs[i];
      const el = box.querySelector("svg");
      if (!el) throw new Error("SVG 解析失敗");
      await svg2pdf(el, doc, { x: 0, y: 0, width: pageWmm, height: pageHmm });
      // 讓出主執行緒，零件多時 UI 才不會卡死
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    box.remove();
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
