/**
 * 中性品牌（Furniture Blueprints）的文字轉換 —— 純函式，server / client / 測試都能用。
 *
 * 用在：
 *  - i18n/request.ts：中性網域時把整包 en.json 深層跑一次（neutralizeMessages）
 *  - 程式裡寫死的英文字串（模板行銷文案、PDF 頁尾等）：neutralizeText
 *
 * ⚠️ 只有中性網域才會呼叫；主站（designer.woodenren.com / cnc.woodenren.com）完全不經過這裡。
 * ⚠️ 測試（lib/brand-text.test.ts）會把轉換後的整包 messages 掃一遍，
 *    斷言不含 /wooden ?ren|woodenren|木頭仁|200K|YouTuber/i —— en.json 加新字串時被擋，
 *    就到下面 KEY_OVERRIDES 補一條或調整通用規則。
 */
import { NEUTRAL_BRAND_NAME } from "./brand-hosts";

/** 掃描用的露餡字樣（測試與 QA 腳本共用） */
export const BRAND_LEAK_RE = /wooden ?ren|woodenren|木頭仁|200K|YouTuber/i;

/**
 * 逐 key 覆寫：通用替換會變成怪句子、或整句是在介紹本人的，直接給中性版本。
 * key 是 messages 的點路徑（陣列用數字索引）。值為 "" 代表整句拿掉。
 */
export const KEY_OVERRIDES: Record<string, string> = {
  // 頁尾：學院名稱 → 產品名；版權字樣不寫公司名
  "footer.brand": NEUTRAL_BRAND_NAME,
  "footer.copyrightSuffix": "All rights reserved.",
  "logo.alt": NEUTRAL_BRAND_NAME,

  // 介紹本人的句子（about / contact 在中性網域是封鎖頁，但 messages 一樣要乾淨）
  "about.hero.badge": "Parametric furniture plans",
  "about.hero.statSubsCount": "25+",
  "about.hero.statSubsLabel": "Furniture templates",
  "about.bio.h2": "About Furniture Blueprints",
  "about.bio.p1":
    "Furniture Blueprints turns dimensions into buildable woodworking plans: three-view drawings, joinery details, cut lists and build steps.",
  "about.bio.ytAria": "YouTube",
  "about.bio.fbAria": "Facebook",
  "about.bio.igAria": "Instagram",
  "about.bio.academyAria": "Course site",
  "about.plans.bugReport":
    "Hit a bug or stuck? Tap the <b>bug-report icon at the bottom right of any page</b><dim> (like the one on the left)</dim> to report it — it auto-attaches the current page and browser info so we can fix it.",
  "contact.companyName": `Service: ${NEUTRAL_BRAND_NAME}`,
  "contact.companyAddress": "",
  "contact.companyOwner": "",
  "contact.ytHandle": "",
  "contact.metadata.description": `Contact information for ${NEUTRAL_BRAND_NAME}.`,
  "contact.metadata.ogDescription": `${NEUTRAL_BRAND_NAME} contact info and support channels.`,

  // 首頁 / 落地頁
  "landing.hero.badge": `${NEUTRAL_BRAND_NAME} · v0.5`,
  "landing.pricing.yearNote": "Yearly billing saves over a month",
  "landing.bottomCta.ctaSecondary": "How it works",
  "home.heroBadge": `${NEUTRAL_BRAND_NAME} · v0.5`,
  "landing.metadata.description":
    "Free online furniture design plan generator, no CAD needed: enter dimensions to auto-generate three-view drawings, joinery details, a materials list, and a cut list in 3 minutes. Free forever for the square stool, pencil holder and workbench.",
  "landing.metadata.ogDescription":
    "Enter dimensions, get furniture three-view drawings, a materials list and a cut list in 3 minutes. Free forever for stool, pencil holder and workbench.",

  // 工作台落地頁（原文是本人口吻的「為什麼免費」）
  "workbenchLanding.metadata.description":
    "The workbench template is free for everyone who wants to start woodworking: Roubo slab-top, apron (Nicholson), tool-well, 20mm MFT grid and double-sided classroom bench. Height-based bench height, front vise, dog holes and holdfast holes placed automatically. No login, no signup — three-views, cut list, part drawings and stock layout right away.",
  "workbenchLanding.hero.badge": "Free for everyone who wants to start woodworking",
  "workbenchLanding.why.p1":
    "The thing that stops most beginners isn't skill — it's not having anywhere to work. Chopping mortises on the dining table, sawing on the balcony floor: two tries and they give up.",
  "workbenchLanding.why.sign": "",
  "workbenchLanding.choose.styles.classroom.desc":
    "Two people face to face, each with their own vise and row of dog holes — the classic shared classroom bench.",

  // 價格 / 學院學員相關
  "pricingFaqs.5.q": "Are there discounts?",
  "pricingFaqs.5.a":
    "From time to time we run promotions. Contact us by email if you are buying for a class or a group.",
  "terms.sec4Li2":
    "Personal / Pro plans are billed monthly or annually, subject to the then-current plan description.",
  "templateDetail.freeTitle": "{name} is a beginner-practice template — free for everyone",
  "templateDetail.pricingFootnoteText": "Annual plan saves one month · ",
  "studentLoginHint.body":
    "Sign in to unlock the full toolkit (unlimited storage, PDF downloads, custom quoting, and more).",

  // 法律頁：營業主體名稱 / 地址（Lemon Squeezy 是 merchant of record）
  "terms.sec1Suffix": ". Contact email: ",
  "terms.metaDescription": `${NEUTRAL_BRAND_NAME} Terms of Service.`,
  "refund.metaDescription": `Refund policy for ${NEUTRAL_BRAND_NAME}.`,
  "refund.sec5Addr": "",
  "refund.client.applyP1Strong": "email us directly",

  // 元件小字
  "perspectiveView.assemblyDuckTitle": "A coffee-drinking duck keeps you company. Click to hide.",
  "bugReport.panelH": "Send a bug report",
  "bugReport.logoAlt": NEUTRAL_BRAND_NAME,
  "studentLoginHint.logoAlt": NEUTRAL_BRAND_NAME,
  "brandingGate.bodyStrong": "Until you set this up, customers see the default branding",
  "brandingForm.phCompanyZh": "e.g. Oak & Pine Studio",
  "brandingForm.phCompanyEn": "e.g. Oak & Pine Studio LLC",
  "brandingForm.phTagline": "e.g. OAK & PINE · Handmade Furniture",
  "brandingForm.phBankAccount": "e.g. Oak & Pine / 0123-456-789012",
  "designError.body":
    "Usually a dimension combination outside the reasonable range. You can reset to defaults, or report this bug to us.",
  "globalError.bodyPre":
    "Please retry or refresh the page. If the issue keeps happening, contact us at ",
  "askMaster.btnTitle": "Copy the current design as a question",

  // AI 師傅（/chat 在中性網域封鎖；字串仍要乾淨）
  "chat.metaTitle": "AI Woodworking Assistant · 24h Q&A",
  "chat.metaDescription":
    "Ask woodworking questions — joinery, wood, finishing, safety, machines, repair, carving.",
  "chat.headerH1": "🪵 AI Woodworking Assistant",
  "chat.emptyIntro1": "I'm an AI woodworking assistant.",
  "chat.disclaimerLine2": "Powered by Claude Haiku 4.5",
};

/**
 * 通用替換（依序套用）。先處理長的品牌全名，最後才是裸的 "Wooden Ren"。
 * `origin` 例：https://furniture-blueprints.vercel.app
 */
function genericRules(origin: string): Array<[RegExp, string]> {
  const host = origin.replace(/^https?:\/\//, "");
  const B = NEUTRAL_BRAND_NAME;
  return [
    [/https?:\/\/designer\.woodenren\.com/gi, origin],
    [/designer\.woodenren\.com/gi, host],
    [/https?:\/\/(www\.)?woodenren\.com\/?/gi, origin],
    [/(?<![\w.-])(www\.)?woodenren\.com/gi, host],
    [/woodenren\.easy\.co/gi, host],
    [/woodenrenclass\.com/gi, host],
    [/@woodenren_bot/gi, "the assistant"],
    [/@woodenren\b/gi, ""],
    [/Wooden Ren Education Co\., Ltd\./g, B],
    [/Wooden Ren (?:Carpentry |Carpenter |Woodworking )?(?:woodworking )?Academy/gi, B],
    [/Wooden Ren woodworking academy/gi, B],
    [/Wooden Ren (?:Furniture )?(?:Designer|Blueprints?)/gi, B],
    [/Wooden Ren furniture design tool/gi, B],
    [/WOODEN REN · Furniture Blueprints/g, B.toUpperCase()],
    [/WOODEN REN/g, B.toUpperCase()],
    [/By the Furniture Blueprints\b/g, "By"],
    [/Furniture Blueprints's\b/g, "our"],
    [/Wooden Ren's\b/gi, "our"],
    [/(DM|email|contact) Wooden Ren\b/gi, "$1 us"],
    [/ — on the house from Wooden Ren/gi, ""],
    [/\s*\(by Wooden Ren\)/gi, ""],
    [/Wooden Ren/gi, B],
    [/,\s*木頭仁\s*≥\s*\d+\s*kg/g, ""],
    [/木頭仁/g, B],
    // 介紹本人的數字
    [/\b200K\b/gi, ""],
    [/200,000 people/gi, "Many people"],
    [/YouTubers?/gi, "creator"],
    // 中性品牌名重複疊在一起（例："Furniture Blueprints Furniture Blueprints v0.5"）
    [new RegExp(`${B}(?:\\s*[·:|—-]?\\s*${B})+`, "g"), B],
  ];
}

/** 單一字串的中性化（不查 KEY_OVERRIDES） */
export function neutralizeText(s: string, origin: string): string {
  let out = s;
  for (const [re, rep] of genericRules(origin)) out = out.replace(re, rep);
  return out;
}

/**
 * 深層轉換整包 messages（不改原物件，回傳新物件）。
 * 先查 KEY_OVERRIDES，沒有就走通用替換。
 */
export function neutralizeMessages<T>(messages: T, origin: string): T {
  const walk = (node: unknown, path: string): unknown => {
    if (typeof node === "string") {
      if (Object.prototype.hasOwnProperty.call(KEY_OVERRIDES, path)) return KEY_OVERRIDES[path];
      return neutralizeText(node, origin);
    }
    if (Array.isArray(node)) return node.map((v, i) => walk(v, path ? `${path}.${i}` : String(i)));
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = walk(v, path ? `${path}.${k}` : k);
      }
      return out;
    }
    return node;
  };
  return walk(messages, "") as T;
}

/**
 * AI 助手的 system prompt：中性網域把「台灣 woodworking YouTuber 木頭仁」這類身分設定換掉，
 * 並要求回覆不提任何真人 / 品牌（避免模型在建議裡自稱木頭仁）。
 */
export function neutralizePrompt(prompt: string): string {
  return (
    prompt
      .replace(/台灣 woodworking YouTuber 木頭仁 木作藍圖/g, NEUTRAL_BRAND_NAME)
      .replace(/台灣 woodworking YouTuber 木頭仁/g, NEUTRAL_BRAND_NAME)
      .replace(/「?木頭仁 木作藍圖」?/g, `「${NEUTRAL_BRAND_NAME}」`)
      .replace(/木頭仁/g, NEUTRAL_BRAND_NAME) +
    `\n\n（回覆內容不要提到任何真實人物、YouTuber 或品牌名稱。）`
  );
}
