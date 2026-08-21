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

/**
 * fetchFontSubset 失敗時拋出的錯誤，帶 HTTP 狀態碼（若有）方便呼叫端依狀態碼
 * 分情況給使用者訊息（400 字元過多 / 429 rate limit / 其他）。
 */
export class FontSubsetError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "FontSubsetError";
  }
}

/** 向伺服器要這批 SVG 用得到的字型子集，回 base64。 */
export async function fetchFontSubset(svgs: string[]): Promise<string> {
  const res = await fetch("/api/pdf-font", {
    method: "POST",
    body: JSON.stringify({ chars: collectChars(svgs) }),
  });
  if (!res.ok) throw new FontSubsetError(`字型子集失敗：${res.status}`, res.status);
  const buf = new Uint8Array(await res.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

/**
 * 同一種紙張的多張 SVG → 一份多頁 PDF。
 *
 * ℹ️ 隱藏容器用 left:-99999px 而不是 display:none —— 這是防禦性寫法，不是硬性依賴。
 *    2026-08-19 在目前釘住的 jspdf 4.2.1 / svg2pdf.js 2.7.0 上實測過：兩種寫法產出的
 *    PDF 去掉 /CreationDate 與 /ID 後 byte-identical。這版 svg2pdf 的文字量測走自己掛在
 *    document.body 下的量測節點，不看呼叫端傳進來的容器可不可見，舊版那個「getBBox() 在
 *    未參與版面的元素上回 0」的地雷已被上游修掉。保留只因零成本、且可防未來升版又改回去。
 *    要改成 display:none 的話，先跑 `npm run verify:template` 比對輸出。
 * ⚠️ SVG 內的 font-family 必須是 "PackCJK"（sheet.ts 已這樣寫），
 *    否則 svg2pdf 會去找 helvetica，中文變亂碼。
 * ⚠️ 目前只有 Noto Sans TC Regular 一種粗細，normal / bold 都註冊同一支字型檔——
 *    700 的字不會亂碼，只是不會真的變粗（刻意接受，見 task-6-brief）。
 */
export interface PdfMeta {
  /** 文件標題,會顯示在 PDF 閱讀器的視窗標題列。 */
  title: string;
  /** 一句話說明這份檔案是什麼。 */
  subject?: string;
}

/**
 * 產出檔案的固定文件屬性。
 *
 * 為什麼要設:2026-08-21 使用者的防毒(Avast)把 `02_樣板_A4.pdf` 判成
 * `PDF:MalwareX-gen [Scam]` 丟進隔離區。實際拆檔掃過,裡面**沒有任何可執行
 * 構件**——沒有 /JavaScript、/JS、/Launch、/EmbeddedFile、/URI、/XFA;唯一的
 * /OpenAction 是 `[3 0 R /FitH null]`,純粹是「開檔跳到第幾頁」的位置指示,
 * 不是動作字典。所以那是誤判。
 *
 * 但當時整份檔案的文件屬性**全是空的**(沒有 Title / Author / Subject /
 * Creator,Producer 只有 "jsPDF 4.2.1")——「空白 metadata + 程式產生器」正是
 * 啟發式引擎評分時的加分項。補上老實的屬性不保證不再被誤判,但拿掉了一個
 * 明確的可疑訊號,順帶讓 PDF 在閱讀器裡有正確標題。
 */
const PDF_AUTHOR = "木頭仁 木作藍圖";
const PDF_CREATOR = "木作藍圖 designer.woodenren.com";
const PDF_KEYWORDS = "木工,家具,1:1 實尺樣板,woodworking template";

/**
 * 把 catalog 裡的 `/OpenAction [3 0 R /FitH null]` 用**等長空白**蓋掉。
 *
 * 為什麼要拿掉:2026-08-21 補完文件屬性之後,Avast 仍然把 `02_樣板_A4.pdf` 判成
 * `PDF:MalwareX-gen [Scam]`(拆檔確認過:/JavaScript /JS /Launch /EmbeddedFile
 * /XFA /SubmitForm /RichMedia /GoToR /ImportData /AA /URI **全部 0 次**,是誤判)。
 * `/OpenAction` 是整份檔案裡最後一個「長得像動作」的 token —— 這裡的它其實只是
 * `[頁物件 /FitH null]` 這種**目的地陣列**(開檔顯示第一頁、寬度符合視窗),不是
 * 動作字典,但只做字串比對的啟發式引擎分不出來。拿掉它不保證解決誤判,只是把最後
 * 一個可疑訊號也除掉;代價僅僅是開檔時不自動符合視窗寬度。
 *
 * ⭐**為什麼不從 jsPDF 那邊關掉**:`setZoomMode` 有白名單
 * (undefined/null/fullwidth/fullheight/fullpage/original/數字/"N%"),傳別的字串會 throw;
 * 而傳 null 之後 `putCatalog` 又有 `if (!zoomMode) zoomMode = "fullwidth"` 把它補回來。
 * 公開 API 繞不掉,只能產完再動位元組。
 *
 * ⭐**為什麼是「等長空白」而不是刪掉**:PDF 的 xref 表記的是每個物件的**位元組偏移**。
 * 刪掉任何位元組都會讓後面所有偏移失準 —— 而「xref 對不上」本身就是防毒眼中的可疑
 * 特徵,那是拿一個誤判去換一個更大的誤判。用空白覆蓋則檔案長度一個位元組都不變,
 * 字典裡多幾個空白在 PDF 語法上完全合法。
 *
 * ⭐**為什麼只在 catalog 那一段搜**:整份檔案含字型子集的二進位串流,對全檔跑正則
 * 有機會誤命中串流內容、寫壞字型。故先錨定最後一個 `/Type /Catalog`,只在它到
 * `endobj` 之間動手。
 */
export function stripOpenAction(bytes: Uint8Array): Uint8Array {
  // latin1 = 1 byte 對 1 char,字元索引與位元組偏移一比一,才能安全換算回去。
  const text = new TextDecoder("latin1").decode(bytes);
  const cat = text.lastIndexOf("/Type /Catalog");
  if (cat < 0) return bytes;
  const endObj = text.indexOf("endobj", cat);
  const seg = text.slice(cat, endObj < 0 ? Math.min(text.length, cat + 2000) : endObj);
  const m = /\/OpenAction\s*\[[^\]]*\]/.exec(seg);
  if (!m) return bytes;
  const out = new Uint8Array(bytes); // 複製一份,不動呼叫端的 buffer
  const start = cat + m.index;
  for (let i = 0; i < m[0].length; i++) out[start + i] = 0x20; // 0x20 = 空白
  return out;
}

export async function svgsToPdf(
  svgs: string[],
  pageWmm: number,
  pageHmm: number,
  fontB64: string,
  meta?: PdfMeta,
): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const { svg2pdf } = await import("svg2pdf.js");

  const doc = new jsPDF({
    unit: "mm",
    format: [pageWmm, pageHmm],
    orientation: pageWmm >= pageHmm ? "landscape" : "portrait",
  });
  if (meta) {
    doc.setProperties({
      title: meta.title,
      subject: meta.subject ?? meta.title,
      author: PDF_AUTHOR,
      creator: PDF_CREATOR,
      keywords: PDF_KEYWORDS,
    });
  }
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
  return stripOpenAction(new Uint8Array(doc.output("arraybuffer")));
}
