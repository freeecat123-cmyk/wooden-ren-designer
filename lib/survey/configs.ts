/**
 * 問卷 config —— 題目/選項硬碼在這。改題重部署即可。
 *
 * 題型：
 *   single   單選（radio）
 *   multi    複選（checkbox）
 *   text     開放文字
 *
 * 設計考量：
 *   - 不放 DB：admin 改題沒這麼頻繁，硬碼 + git history 就是 audit log
 *   - answers jsonb key = question.id（穩定不變、不可改）
 *   - 改完問卷後既有 response 仍能讀（key 對得到的還在、新題默默 missing）
 */

export type QuestionType = "single" | "multi" | "text";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  allowOther?: boolean; // multi/single 加「其他____」開放輸入
}

export interface SurveyConfig {
  id: string;
  title: string;
  intro: string;
  /** 完成後送的 coupon 設定（給 launch survey 半價券用） */
  couponReward?: {
    discountPercent: number;
    expiresInDays: number;
  };
  questions: Question[];
}

/** 2026-05-22 開賣首週問卷 */
export const LAUNCH_2026_05_SURVEY: SurveyConfig = {
  id: "launch-2026-05",
  title: "木頭仁木作藍圖｜給你 5 分鐘，幫我改得更好用",
  intro: [
    "你好,我是木頭仁。",
    "謝謝你在開賣第一天就註冊木作藍圖。",
    "這個工具還很年輕,你的回饋會直接影響我接下來幾個月怎麼改。",
    "填完問卷會收到專屬半價 coupon(個人版年付 NT$3,900 → NT$1,950,7 天內有效)。",
    "2~3 分鐘搞定,我會逐則看。",
  ].join("\n\n"),
  couponReward: {
    discountPercent: 50,
    expiresInDays: 7,
  },
  questions: [
    {
      id: "q1_role",
      type: "single",
      label: "你是哪一種人?",
      required: true,
      allowOther: true,
      options: [
        { value: "yt_fan", label: "木頭仁 YouTube 觀眾/粉絲" },
        { value: "hobbyist", label: "木工自學者/業餘玩家" },
        { value: "academy", label: "木匠學院學員" },
        { value: "pro", label: "接案木工/工作室" },
        { value: "designer", label: "室內裝潢/設計師" },
        { value: "homeowner", label: "屋主想自己 DIY" },
      ],
    },
    {
      id: "q2_source",
      type: "single",
      label: "你是怎麼找到木作藍圖的?",
      required: true,
      allowOther: true,
      options: [
        { value: "youtube", label: "木頭仁 YouTube" },
        { value: "fb", label: "木頭仁 FB" },
        { value: "ig", label: "木頭仁 IG" },
        { value: "line", label: "Line 木工群組" },
        { value: "academy", label: "木匠學院" },
        { value: "friend", label: "朋友推薦" },
        { value: "google", label: "Google 搜尋" },
      ],
    },
    {
      id: "q3_actions",
      type: "multi",
      label: "註冊之後你做了什麼?",
      help: "可複選；最後一項與前面互斥",
      required: true,
      options: [
        { value: "tried_free", label: "試了免費版的方凳 / 筆筒" },
        { value: "saw_paid", label: "看了付費版範本但沒解鎖" },
        { value: "click_upgrade", label: "點了「升級個人版」但沒付款" },
        { value: "just_browse", label: "看了一下就關掉" },
        { value: "not_logged", label: "還沒登入過" },
      ],
    },
    {
      id: "q4_blockers",
      type: "multi",
      label: "還沒升級付費的原因?（最重要的一題）",
      help: "可複選",
      required: true,
      allowOther: true,
      options: [
        { value: "free_enough", label: "免費版的範本就夠我用" },
        { value: "still_thinking", label: "想再試幾天才決定" },
        { value: "too_expensive", label: "NT$390/月太貴" },
        { value: "uncertain_value", label: "不確定我能用到值回票價" },
        { value: "prefer_lifetime", label: "比較想一次買斷,不想訂閱" },
        { value: "wait_project", label: "等做家具時才訂(現在沒在做)" },
        { value: "use_cad", label: "我自己會畫圖/不需要輔助工具" },
        { value: "feature_gap", label: "還有功能不齊,想看完整版" },
      ],
    },
    {
      id: "q4b_fair_price",
      type: "single",
      label: "個人版你覺得多少錢算合理?",
      help: "幫我判斷現在 NT$390/月 的定價是不是真的太高",
      required: true,
      options: [
        { value: "p_199", label: "NT$199/月" },
        { value: "p_290", label: "NT$290/月" },
        { value: "p_390_fair", label: "NT$390/月 合理" },
        { value: "p_higher_ok", label: "更高也 OK，內容夠就值" },
        { value: "no_sub", label: "我不訂閱，怎麼便宜都不會付" },
      ],
    },
    {
      id: "q5_unlock_tiered",
      type: "single",
      label: "如果單範本「永久買斷」依難度分階,你會買嗎?",
      help: "入門(方凳/筆筒等) NT$199、中階(邊桌/茶几/紅酒架等) NT$299、進階(衣櫃/餐桌/餐椅等) NT$499",
      required: true,
      options: [
        { value: "yes_all_fair", label: "會,三階價格都合理" },
        { value: "yes_low_only", label: "會,但只想買入門(199),中/進階太貴" },
        { value: "yes_mid_max", label: "會,入門+中階可以,進階(499)不買" },
        { value: "no_too_expensive", label: "不會,進階 499 還是太貴" },
        { value: "no_prefer_subscription", label: "不會,還是月付訂閱划算" },
        { value: "no_free", label: "不會,我會繼續用免費版" },
      ],
    },
    {
      id: "q5b_preferred_model",
      type: "single",
      label: "如果只能選一種,你比較想用哪一種付款方式?",
      help: "都是目前已經有的方案",
      required: true,
      options: [
        { value: "monthly", label: "月付訂閱 NT$390(全部範本任意使用,不續訂就停)" },
        { value: "yearly", label: "年付 NT$3,900(省 2 個月)" },
        { value: "per_template", label: "單範本買斷(199~499/張,永久擁有那張)" },
        { value: "still_free", label: "都不買,免費版就好" },
      ],
    },
    {
      id: "q5c_most_wanted_template",
      type: "multi",
      label: "你最想解鎖哪幾個範本?",
      help: "可複選；告訴我下一個該優先優化哪個",
      required: false,
      allowOther: true,
      options: [
        { value: "desk", label: "書桌 / 辦公桌" },
        { value: "dining-chair", label: "餐椅" },
        { value: "dining-table", label: "餐桌" },
        { value: "wardrobe", label: "衣櫃" },
        { value: "open-bookshelf", label: "開放書櫃" },
        { value: "chest-of-drawers", label: "斗櫃" },
        { value: "shoe-cabinet", label: "鞋櫃" },
        { value: "media-console", label: "電視櫃" },
        { value: "nightstand", label: "床頭櫃" },
        { value: "tea-table", label: "茶几" },
        { value: "side-table", label: "邊桌" },
        { value: "bench", label: "長凳" },
        { value: "bar-stool", label: "吧檯椅" },
        { value: "wine-rack", label: "紅酒架" },
        { value: "dovetail-box", label: "木盒" },
      ],
    },
    {
      id: "q6_features",
      type: "multi",
      label: "最希望加什麼功能?",
      help: "最多選 3 個",
      required: true,
      allowOther: true,
      options: [
        { value: "more_templates", label: "更多家具範本" },
        { value: "interior_layout", label: "室內配置/空間規劃" },
        { value: "moulding", label: "線板/踢腳板算料" },
        { value: "video_links", label: "工序影片教學連結" },
        { value: "mobile_app", label: "行動 App" },
        { value: "i18n", label: "中文以外的語言版本" },
      ],
    },
    {
      id: "q6b_nps",
      type: "single",
      label: "你會推薦木作藍圖給朋友嗎?",
      help: "0=絕對不會、10=一定會",
      required: true,
      options: [
        { value: "0", label: "0 — 絕對不會" },
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "5", label: "5 — 普通" },
        { value: "6", label: "6" },
        { value: "7", label: "7" },
        { value: "8", label: "8" },
        { value: "9", label: "9" },
        { value: "10", label: "10 — 一定會推薦" },
      ],
    },
    {
      id: "q7_message",
      type: "text",
      label: "想跟我說一句話?(這欄我會逐則看)",
    },
  ],
};

export const SURVEYS: Record<string, SurveyConfig> = {
  [LAUNCH_2026_05_SURVEY.id]: LAUNCH_2026_05_SURVEY,
};

export function getSurvey(id: string): SurveyConfig | null {
  return SURVEYS[id] ?? null;
}

/**
 * 驗證 answer 格式符合 question type
 *   - single: string（其中一個 option.value，或 "other:xxx"）
 *   - multi: string[]
 *   - text: string
 *   - required 沒填 → 拒絕
 */
export function validateAnswers(
  config: SurveyConfig,
  answers: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  for (const q of config.questions) {
    const a = answers[q.id];
    if (q.required) {
      if (a === undefined || a === null) {
        return { ok: false, error: `第 ${q.id} 題未作答` };
      }
      if (q.type === "multi" && Array.isArray(a) && a.length === 0) {
        return { ok: false, error: `第 ${q.id} 題未作答` };
      }
      if (q.type === "text" && typeof a === "string" && !a.trim()) {
        return { ok: false, error: `第 ${q.id} 題未作答` };
      }
    }
    if (a === undefined || a === null) continue;
    if (q.type === "single" && typeof a !== "string") {
      return { ok: false, error: `第 ${q.id} 題格式錯誤` };
    }
    if (q.type === "multi" && !Array.isArray(a)) {
      return { ok: false, error: `第 ${q.id} 題格式錯誤` };
    }
    if (q.type === "text" && typeof a !== "string") {
      return { ok: false, error: `第 ${q.id} 題格式錯誤` };
    }
  }
  return { ok: true };
}

/** 產 coupon code：SURVEY-{base36 random 8 字} */
export function generateCouponCode(surveyId: string): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  const prefix = surveyId.split("-")[0].toUpperCase().slice(0, 6);
  return `${prefix}-${rand}`;
}
