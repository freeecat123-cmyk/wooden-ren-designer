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
    "填完問卷會收到專屬半價 coupon(個人版 NT$195/月)。",
    "2 分鐘搞定,我會逐則看。",
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
      help: "可複選",
      required: true,
      options: [
        { value: "tried_free", label: "試了免費版的 3 個範本" },
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
        { value: "free_enough", label: "免費版的 3 個範本就夠我用" },
        { value: "still_thinking", label: "想再試幾天才決定" },
        { value: "too_expensive", label: "NT$390/月太貴" },
        { value: "uncertain_value", label: "不確定我能用到值回票價" },
        { value: "prefer_lifetime", label: "比較想一次買斷,不想訂閱" },
        { value: "wait_project", label: "等做家具時才訂(現在沒在做)" },
        { value: "use_cad", label: "已經會 SketchUp/AutoCAD,不需要" },
        { value: "feature_gap", label: "還有功能不齊,想看完整版" },
      ],
    },
    {
      id: "q5_unlock_tiered",
      type: "single",
      label: "如果單範本「永久買斷」依難度分階,你會買嗎?",
      help: "入門(方凳/筆筒/邊桌等) NT$199、中階(餐椅/書桌/紅酒架等) NT$299、進階(衣櫃/餐桌/書櫃等) NT$499",
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
      label: "如果只能選一種,你比較想要哪一種付款方式?",
      help: "純假設題,幫我判斷產品方向",
      required: true,
      options: [
        { value: "monthly", label: "月付訂閱 NT$390(23 範本全用,不續訂就停)" },
        { value: "yearly", label: "年付 NT$3,900(省 2 個月)" },
        { value: "per_template", label: "單範本買斷(199~499/張,永久擁有那張)" },
        { value: "still_free", label: "都不買,免費版就好" },
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
        { value: "floor", label: "木地板施工模擬器" },
        { value: "quote", label: "報價單(給接案用)" },
        { value: "video_links", label: "工序影片教學連結" },
        { value: "mobile_app", label: "行動 App" },
        { value: "i18n", label: "中文以外的語言版本" },
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
