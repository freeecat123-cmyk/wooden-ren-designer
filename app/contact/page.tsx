import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "聯絡我們 · 木頭仁 木作藍圖",
  description:
    "木頭仁 木作藍圖（designer.woodenren.com）聯絡資訊 — 由木頭仁木匠學院 Wooden Ren Education Co., Ltd. 提供。",
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-bold tracking-tight">聯絡我們</h1>
      <p className="mt-2 text-sm text-zinc-500">最後更新：2026 年 5 月 13 日</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">公司資訊</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>公司名稱：Wooden Ren Education Co., Ltd.（木頭仁木匠學院）</li>
          <li>登記地址：基隆市暖暖區東勢街 6-34 號 4 樓</li>
          <li>負責人：翁彬仁（木頭仁）</li>
          <li>
            官方網站：
            <a className="underline" href="https://woodenren.com" target="_blank" rel="noopener noreferrer">
              woodenren.com
            </a>
          </li>
          <li>
            本服務網址：
            <a className="underline" href="https://designer.woodenren.com">designer.woodenren.com</a>
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">客服聯絡</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            客服信箱：
            <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>
          </li>
          <li>客服時間：週一至週五 10:00–18:00（國定假日休）</li>
          <li>回覆時間：一般 1~3 個工作日內回覆。</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">問題類型</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>付款／開通／發票問題 → 主旨請註明「付款問題 - 訂單編號」</li>
          <li>
            退費申請 → 請參考
            <a className="underline" href="/refund">退費政策</a>
            後來信
          </li>
          <li>功能 bug、設計建議、教學合作 → 直接信件說明即可</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">社群</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            YouTube：
            <a
              className="underline"
              href="https://www.youtube.com/@woodenren"
              target="_blank"
              rel="noopener noreferrer"
            >
              @woodenren（木頭仁 Wooden Ren）
            </a>
          </li>
          <li>
            木匠學院：
            <a
              className="underline"
              href="https://woodenrenclass.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              woodenrenclass.com
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}
