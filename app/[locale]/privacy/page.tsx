import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策 · 木頭仁 木作藍圖",
  description:
    "木頭仁 木作藍圖（木作藍圖）隱私權政策 — 我們蒐集什麼資料、做什麼用、怎麼保護。",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "隱私權政策 · 木頭仁 木作藍圖",
    description: "木頭仁 木作藍圖隱私權政策。",
    url: "/privacy",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-bold tracking-tight">隱私權政策</h1>
      <p className="mt-2 text-sm text-zinc-500">最後更新：2026 年 5 月 12 日</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">1. 我們是誰</h2>
        <p>
          本服務由 <strong>Wooden Ren Education Co., Ltd.（木頭仁木匠學院）</strong>
          營運。負責人聯絡信箱：
          <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>。
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">2. 我們蒐集哪些資料</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>帳號資料：</strong>Email、顯示名稱、頭像（若使用 Google 登入）、註冊時間。
          </li>
          <li>
            <strong>設計資料：</strong>使用者建立的設計檔（家具類型、尺寸、選項、報價內容、客戶資料）。
          </li>
          <li>
            <strong>付款紀錄：</strong>付款時間、方案類型、訂閱到期日；
            <strong>不儲存信用卡卡號或 CVV</strong>（由金流業者直接處理）。
          </li>
          <li>
            <strong>系統紀錄：</strong>IP 位址、瀏覽器 UA、錯誤訊息（用於排除故障），保存最多 90 天。
          </li>
          <li>
            <strong>使用者主動回報內容：</strong>站內右下角 🐛「回報」按鈕送出的郵件、客服信件。
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">3. 資料用途</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>提供與維護本服務功能（登入、儲存設計、列印、報價）。</li>
          <li>方案到期通知、付費收據、重大條款變更通知。</li>
          <li>排除系統故障、改善服務品質。</li>
          <li>經您同意後，發送產品改版／教學內容／優惠資訊（可隨時退訂）。</li>
        </ul>
        <p>
          我們<strong>不會</strong>將您的個人資料販售或交換給第三方做行銷用途。
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">4. 我們使用的第三方服務</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>Supabase（資料庫＋登入）</strong>：儲存帳號與設計資料，伺服器位於 AWS 新加坡區。</li>
          <li><strong>Vercel（部署）</strong>：託管網站本體；存放 build artefacts 與系統 log。</li>
          <li><strong>Google OAuth</strong>（若您使用 Google 登入）：僅取得 Email、姓名、頭像。</li>
          <li><strong>Anthropic Claude API</strong>（若使用「照片轉設計」功能）：上傳的圖片會傳送給 Anthropic 進行影像辨識，
            Anthropic 不會將內容用於模型訓練（依其 API 服務條款）。</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">5. Cookie 與本機儲存</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>登入維持：Supabase Auth 使用 cookie 維持登入狀態。</li>
          <li>使用偏好：報價單抬頭、品牌客製等資訊存於瀏覽器 <code>localStorage</code>，不會上傳伺服器。</li>
          <li>我們<strong>不</strong>使用 Google Analytics 或第三方廣告追蹤 Cookie。</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">6. 您的權利</h2>
        <p>
          依個人資料保護法，您對自己的資料享有下列權利：
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>查詢、閱覽、複製本您的個資。</li>
          <li>請求補充或更正錯誤資料。</li>
          <li>請求停止蒐集、處理、利用或刪除您的個資（含註銷帳號）。</li>
        </ul>
        <p>
          欲行使上述權利，請來信
          <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>。
          我們將於 14 個工作天內處理。
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">7. 資料保存期限</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>帳號與設計資料：保存至您主動申請刪除帳號為止。</li>
          <li>付款紀錄：依稅法規定保存 7 年。</li>
          <li>系統 log：90 天滾動覆寫。</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">8. 兒童隱私</h2>
        <p>
          本服務未設計給 14 歲以下未成年人使用。如發現未成年人未經監護人同意註冊，請來信通知我們刪除帳號。
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">9. 政策修訂</h2>
        <p>
          本政策得隨時修訂並於本頁公告，重大變更會以站內公告或 Email 通知；繼續使用本服務即視為同意修訂後政策。
        </p>
      </section>

      <p className="mt-10 text-sm text-zinc-500">
        如對本政策有任何疑問，請來信
        <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>。
      </p>
    </main>
  );
}
