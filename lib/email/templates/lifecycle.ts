/**
 * 生命週期自動信（2026-09-03 草稿定稿版）。
 * 純字串模板，內文照木頭仁核過的草稿一字不改；名字沒有時用「你好」。
 *
 * 六封：
 *   new_d1    註冊滿 24h、還沒存過設計
 *   new_d3    註冊滿 3 天、未付費
 *   new_d7    註冊滿 7 天、未付費
 *   reengage_1 舊免費用戶回訪第 1 封
 *   reengage_2 舊免費用戶回訪第 2 封（第 1 封後 7 天）
 *   winback   訂閱到期 / 取消超過 14 天的回流信
 *
 * 2026-09-03 晚加三封（規則見 lifecycle-rules.ts）：
 *   post_purchase_photo 買（付款成功 / 單範本買斷 / 工具買斷）滿 7 天要照片
 *   checkout_abandoned  走到結帳沒付款 24～72h 追一封（vars.link）
 *   viewed_template     看過付費範本 3～10 天沒買（vars.category / label / hint / price；
 *                       dedup key 存成 viewed_template_<category>，每人只寄一款）
 */
import { escapeHtml } from "../escape";

export type LifecycleEmailKey =
  | "new_d1"
  | "new_d3"
  | "new_d7"
  | "reengage_1"
  | "reengage_2"
  | "winback"
  | "post_purchase_photo"
  | "checkout_abandoned"
  | "viewed_template";

/** 寫進 lifecycle_emails.email_key 的字串：viewed_template 帶款名後綴。 */
export type LifecycleSendKey = LifecycleEmailKey | `viewed_template_${string}`;

export const VIEWED_TEMPLATE_PREFIX = "viewed_template_";

/** "viewed_template_wardrobe" → { key:"viewed_template", category:"wardrobe" }；其他原樣回。 */
export function parseSendKey(sendKey: LifecycleSendKey): { key: LifecycleEmailKey; category?: string } {
  if (sendKey.startsWith(VIEWED_TEMPLATE_PREFIX) && sendKey !== "viewed_template") {
    return { key: "viewed_template", category: sendKey.slice(VIEWED_TEMPLATE_PREFIX.length) };
  }
  return { key: sendKey as LifecycleEmailKey };
}

export const LIFECYCLE_EMAIL_KEYS: LifecycleEmailKey[] = [
  "new_d1",
  "new_d3",
  "new_d7",
  "reengage_1",
  "reengage_2",
  "winback",
  "post_purchase_photo",
  "checkout_abandoned",
  "viewed_template",
];

/** 動態內容（依 key 需要不同欄位；沒給就用保守預設） */
export interface LifecycleVars {
  /** checkout_abandoned：帶他要買的那頁（範本頁 / 工具頁 / pricing） */
  link?: string;
  /** viewed_template */
  category?: string;
  label?: string;
  hint?: string;
  price?: number | null;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

function htmlShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08);line-height:1.8">
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af;margin:0">木頭仁家具工程圖工具 · <a href="${SITE_URL}" style="color:#9ca3af">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

/** 純文字 → HTML：escape、網址轉連結、空行分段、單換行 <br>。 */
function textToHtml(text: string): string {
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map((p) => {
      const lines = p.split("\n").map((line) => {
        const esc = escapeHtml(line);
        return esc.replace(
          /(https?:\/\/[^\s<]+)/g,
          (u) => `<a href="${u}" target="_blank" rel="noopener" style="color:#059669">${u}</a>`,
        );
      });
      return `<p style="margin:0 0 16px">${lines.join("<br/>")}</p>`;
    })
    .join("\n");
}

const BODIES: Record<LifecycleEmailKey, { subject: string; body: string }> = {
  new_d1: {
    subject: "先把你的工作桌畫出來，3 分鐘",
    body: `你昨天註冊了木作藍圖，我猜你還沒真的動手。

先不用想要做什麼大家具，先把你的工作桌畫出來——每個木工的第一件作品都該是它，之後每件家具都在它上面做。
這個模板我免費送，開這一頁：
https://designer.woodenren.com/workbench

填你的身高、選一種流派（不知道選哪個就選厚板桌），
右邊的 3D 會跟著變，下面三視圖、材料單、零件圖、孔位也會一起重算。
免費版只有方凳、筆筒和木工工作桌這三個可以改到底（列印 PDF 要付費）。

改完你會看到我平常做木工前自己在看的那張圖。
先看懂這一張，其他家具都是同一套。

木頭仁`,
  },
  new_d3: {
    subject: "把你家的尺寸放進去看看",
    body: `大部分人來這裡是有一個具體的東西想做：鞋櫃、衣櫃、書桌、餐桌。

其他所有範本不用付費就能點進去看：3D、三視圖、榫卯、材料單都會顯示，
但尺寸是鎖在範例值的，改不了。要改成你家的尺寸、列印出來，才要付費或買斷。

先挑一個最接近你要做的：
鞋櫃 https://designer.woodenren.com/templates/shoe-cabinet
衣櫃 https://designer.woodenren.com/templates/wardrobe
書桌 https://designer.woodenren.com/templates/desk
餐桌 https://designer.woodenren.com/templates/dining-table
全部 https://designer.woodenren.com/templates

看的時候注意一件事：每個零件的尺寸是怎麼從整體尺寸推出來的。
這是很多人自己畫圖最常算錯的地方，也是我做這個工具的原因。

木頭仁`,
  },
  new_d7: {
    subject: "只做一件的話，不用訂閱",
    body: `很多人問我「我只想做一張餐桌，要訂閱嗎」。不用。

每個範本都可以單獨買斷，299 或 499 元，買了永久是你的，
尺寸隨便改、隨便印。這比你買一塊做壞的板子便宜。

要做很多件、或接案的，才考慮個人版 390 元/月，
年付 3,900 等於 10 個月，其他兩個月送你。

買斷價目表：https://designer.woodenren.com/pricing

如果你想做的家具範本裡沒有，直接回這封信告訴我是什麼。
我會照大家回的順序加。

木頭仁`,
  },
  reengage_1: {
    subject: "你 5 月註冊的那個藍圖工具，改了很多",
    body: `你 5 月的時候註冊過木作藍圖，我猜之後沒再開過。
這三個月我把它改了很多，講幾個你看得到的：

1. 3D 組裝動畫。每一件家具現在可以一步一步看它怎麼組起來，
   哪支榫先進、抽屜什麼時候裝，還可以輸出成影片。
   （組完會有一隻鴨子跳上去，那是我女兒畫的。）
2. 三視圖和零件圖重新校過一遍，每一款都實際畫出來對過。
3. 手機也能看 3D 了。
4. 不想訂閱的，每個範本可以單獨買斷，299 或 499 元永久用。

免費版一樣可以開所有範本看 3D、三視圖、材料單。
從這裡進：https://designer.woodenren.com/templates

木頭仁`,
  },
  reengage_2: {
    subject: "你想做的是哪一件？",
    body: `上週的信不知道你有沒有點開。

我想問一個問題，回信一句話就好：
你當初註冊的時候，是想做哪一件家具？

範本有的，我回你那一頁的連結，免費開起來看尺寸怎麼抓。
範本沒有的，我記下來排進去做。

這幾個月大家問最多的是鞋櫃、衣櫃、圓桌尺寸，
如果你也是，直接看這三頁：
https://designer.woodenren.com/templates/shoe-cabinet
https://designer.woodenren.com/templates/wardrobe
https://designer.woodenren.com/templates/round-table

木頭仁`,
  },
  winback: {
    subject: "你走了之後，藍圖改的東西",
    body: `你之前訂過木作藍圖，後來到期沒續。
沒關係，我想讓你知道這段時間改了什麼，再決定要不要回來：

- 3D 組裝動畫 + 影片輸出，每件家具的組裝順序都能看
- 每一款的三視圖、零件圖全部重新對過
- 手機可以看 3D
- 天花板骨架、地板、和室架高平台三個工具

如果你當初是做完一件就停，這次可以不用訂閱，
單一範本買斷 299 或 499 元，永久用。

如果你是接案的，年付 3,900 等於 10 個月。

https://designer.woodenren.com/pricing

當初停掉是因為哪裡不好用，回信告訴我，我會改。

木頭仁`,
  },
  post_purchase_photo: {
    subject: "做出來了嗎？",
    body: `你一週前在木作藍圖拿了設計圖，我想問一下：那件做出來了嗎？

做好的話拍一張回這封信給我，正面一張就好，不用修圖。
我想把它放在那款範本頁，給後面想做同一件的人看真的做出來長什麼樣子。
放之前我會先問過你，你不想露出就只我自己看。

做到一半卡住也回信，卡在哪一步、哪個零件，我看圖回你。

木頭仁`,
  },
  checkout_abandoned: {
    subject: "付款那一頁沒走完",
    body: `我看到你前兩天走到木作藍圖的付款頁，沒有完成。

如果是付款卡住（刷不過、頁面跳掉、看不懂要填什麼），回這封信告訴我卡在哪一步，我來處理。

如果只是還在想，不急。你那時看的那頁在這裡：
{{LINK}}

木頭仁`,
  },
  viewed_template: {
    subject: "你上週看的{{LABEL}}設計圖",
    body: `你上週在木作藍圖開過{{LABEL}}的設計圖，我猜你有在想要不要做。
{{HINT}}
那一頁在這：
{{LINK}}

尺寸鎖在範例值改不了，是免費版的限制。
只想做這一件的話，這款可以單獨買斷{{PRICE}}，永久是你的，尺寸隨便改、隨便印。

做之前有哪個尺寸拿不定主意，回信問我。

木頭仁`,
  },
};

export function lifecycleEmail(
  key: LifecycleEmailKey,
  input: { name?: string | null; vars?: LifecycleVars },
): { subject: string; text: string; html: string } {
  const greeting = input.name?.trim() ? input.name.trim() : "你好";
  const v = input.vars ?? {};
  const label = v.label?.trim() || "那款";
  const link =
    v.link?.trim() ||
    (v.category ? `${SITE_URL}/design/${v.category}` : `${SITE_URL}/pricing`);
  const hint = v.hint?.trim() ? `\n${v.hint.trim().replace(/[。.]?$/, "")}。\n` : "";
  const price = typeof v.price === "number" && v.price > 0 ? `，${v.price} 元` : "";
  const subject = BODIES[key].subject.replace("{{LABEL}}", label);
  const body = BODIES[key].body
    .replace(/\{\{LABEL\}\}/g, label)
    .replace("{{LINK}}", link)
    .replace("{{HINT}}", hint)
    .replace("{{PRICE}}", price);
  const text = `${greeting}，\n\n${body}`;
  const html = htmlShell(subject, textToHtml(text));
  return { subject, text, html };
}
