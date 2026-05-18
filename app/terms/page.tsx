import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服務條款 · 木頭仁 木作藍圖",
  description:
    "木頭仁 木作藍圖（木作藍圖）服務條款 — 由木頭仁木匠學院 Wooden Ren Education Co., Ltd. 提供。",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-bold tracking-tight">服務條款</h1>
      <p className="mt-2 text-sm text-zinc-500">最後更新：2026 年 5 月 12 日</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">1. 服務提供者</h2>
        <p>
          本服務（以下稱「本生成器」）由 <strong>Wooden Ren Education Co., Ltd.（木頭仁木匠學院）</strong>
          營運，登記地址：基隆市暖暖區東勢街 6-34 號 4 樓。聯絡信箱：
          <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>。
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">2. 服務內容</h2>
        <p>
          本生成器提供以下功能：輸入家具尺寸/木材/榫卯選項，自動產出 3D 模型、工程三視圖、爆炸圖、
          材料清單、A4 列印工程圖紙；專業版以上另含家具報價系統、客戶資料管理、設計師模式。
        </p>
        <p>
          本生成器仍持續開發中，使用者理解部分功能可能變動、暫停或調整收費方式；重大變更會以站內公告或
          Email 通知。
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">3. 帳號註冊與安全</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>使用者需以真實 Email 註冊；不得冒用他人身分或多重註冊以規避方案限制。</li>
          <li>帳號密碼／登入 Token 由使用者自行妥善保管，因外洩造成之損失由使用者自負。</li>
          <li>本生成器有權對違反條款或惡意行為之帳號，逕行暫停或終止服務。</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">4. 方案與付費</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>免費版可使用部分家具範本（方凳、茶几、筆筒）與每帳號 1 筆設計存檔。</li>
          <li>個人版／專業版採月付或年付訂閱；學員版為木匠學院學員身份開通之免費使用方案，依當下方案說明為準。</li>
          <li>付費完成後通常即時開通；如未開通可來信
            <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>。</li>
          <li>
            <strong>退費政策：</strong>因屬數位內容服務，原則上付款後恕不退費；如遇系統重大瑕疵
            導致無法使用，請於付款 7 日內來信申訴，個案處理。
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">5. 智慧財產權</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>本生成器之程式碼、UI、家具範本、工程圖樣式之著作權屬本公司所有。</li>
          <li>
            使用者透過本生成器產生之<strong>具體尺寸設計檔與列印 PDF</strong>，著作權與商業使用權
            歸使用者；使用者可自由用於自家木工製作、上課教學、接案、銷售成品。
          </li>
          <li>使用者不得將本生成器整體介面、原始檔或範本資料庫重新封裝、轉售、提供給第三方使用。</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">6. 使用者責任與免責</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            本生成器產出之圖紙僅供<strong>設計參考</strong>；實際施作前請依現場木料、機具狀況自行驗算。
            因依照圖紙施作而生之任何損害（含木料浪費、安全事故、結構失敗），本公司不負賠償責任。
          </li>
          <li>本生成器內附之建議用料／用量／工時均為估算值，與實際結果可能有差距。</li>
          <li>使用者不得利用本生成器從事違法、侵權、騷擾或干擾系統穩定之行為。</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">7. 服務變更與中止</h2>
        <p>
          本公司保留隨時修改、暫停或終止全部或部分服務之權利，重大變更會於站內公告或 Email 通知；
          如因服務終止導致已付費期間未使用之部分，將依比例退費。
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">8. 條款修訂</h2>
        <p>
          本條款得隨時修訂並於本頁公告，使用者於修訂後繼續使用本服務即視為同意修訂後條款。
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">9. 準據法與管轄</h2>
        <p>
          本條款以中華民國法律為準據法；因本條款發生爭議，雙方同意以
          <strong> 台灣基隆地方法院 </strong>為第一審管轄法院。
        </p>
      </section>

      <p className="mt-10 text-sm text-zinc-500">
        如對本條款有任何疑問，請來信
        <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>。
      </p>
    </main>
  );
}
