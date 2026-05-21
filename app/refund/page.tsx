import type { Metadata } from "next";
import { RefundClient } from "./RefundClient";

export const metadata: Metadata = {
  title: "退費政策 · 木頭仁 木作藍圖",
  description:
    "木頭仁 木作藍圖（木作藍圖）退費政策 — 由木頭仁木匠學院 Wooden Ren Education Co., Ltd. 提供。",
  alternates: { canonical: "/refund" },
  openGraph: {
    title: "退費政策 · 木頭仁 木作藍圖",
    description: "木頭仁 木作藍圖退費政策。",
    url: "/refund",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function RefundPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-bold tracking-tight">退費政策</h1>
      <p className="mt-2 text-sm text-zinc-500">最後更新：2026 年 5 月 13 日</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">1. 服務性質</h2>
        <p>
          本服務「木頭仁 木作藍圖（designer.woodenren.com）」屬於
          <strong>數位內容／線上軟體服務（SaaS）</strong>，依消費者保護法第 19 條第 2 項及行政院公告
          「通訊交易解除權合理例外情事適用準則」第 2 條第 5 款規定：
          「<em>非以有形媒介提供之數位內容或一經提供即為完成之線上服務，經消費者事先同意始提供</em>」者，
          不適用七日鑑賞期之解除權。
        </p>
        <p>
          使用者於完成付款並開通帳號權限時，即視為已同意立即提供數位內容服務並
          <strong>拋棄七日鑑賞期</strong>。
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">2. 可申請退費之情形</h2>
        <p>原則上付款完成後恕不退費。但以下情形可於付款後 7 日內來信申請個案處理：</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>因本服務之系統重大瑕疵，導致購買之方案完全無法使用且本公司於合理時間內無法修復。</li>
          <li>重複付款（同一方案、同一帳號短時間內重複扣款）。</li>
          <li>因本公司主動終止服務，致已付費期間未使用之部分，依比例退費。</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">3. 不予退費之情形</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>已使用本服務產出工程圖、PDF、3D 模型、報價單或任何下載檔案。</li>
          <li>個人因素（不會用、不想用、家中無木工機具、操作不熟悉等）。</li>
          <li>因違反《服務條款》遭暫停或終止帳號者。</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">4. 退費流程</h2>
        <ol className="ml-5 list-decimal space-y-2">
          <li>
            來信
            <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>
            ，主旨「退費申請 - 註冊 Email」，附訂單編號、付款日期、退費原因。
          </li>
          <li>本公司於收到申請後 7 個工作日內回覆是否受理。</li>
          <li>
            受理後依原付款管道（綠界 ECPay 信用卡／ATM）退回，款項到帳時間依各發卡銀行而定，
            通常為 3〜30 個工作日。
          </li>
          <li>
            因金流手續費屬第三方（綠界、發卡銀行）收取且不予退還，退費金額將
            <strong>扣除已產生之金流手續費</strong>後匯回。
          </li>
        </ol>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">5. 聯絡窗口</h2>
        <p>
          Wooden Ren Education Co., Ltd.（木頭仁木匠學院）<br />
          地址：基隆市暖暖區東勢街 6-34 號 4 樓<br />
          Email：
          <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>
        </p>
      </section>

      <RefundClient />
    </main>
  );
}
