import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "常見問題 FAQ · 木頭仁 木作藍圖",
  description:
    "木頭仁 木作藍圖常見問題：登入、訂閱、付款、發票、退費、PWA 安裝、3D 顯示等使用疑難。",
  alternates: { canonical: "/help" },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";
const LINE_OA_URL = "https://lin.ee/EaXGbJ1";
const SUPPORT_EMAIL = "wengbinren@gmail.com";

interface QA {
  q: string;
  a: React.ReactNode;
}

const SECTIONS: Array<{ title: string; emoji: string; items: QA[] }> = [
  {
    title: "帳號與登入",
    emoji: "🔑",
    items: [
      {
        q: "在 LINE / FB / IG 點連結，登入按鈕沒反應",
        a: (
          <>
            Line / FB / IG 內建瀏覽器不支援 Google 登入。請按右上角「⋯」選「<strong>用瀏覽器開啟</strong>」，或複製連結貼到 Chrome / Safari 再點。
            <br />
            或直接用 <strong>Email 登入信</strong>：登入頁輸入 email，10 分鐘內到信箱點連結即可，不需 Google 帳號。
          </>
        ),
      },
      {
        q: "Email 登入信點了顯示「連結已過期」",
        a: (
          <>
            Email 登入連結只有 <strong>1 小時</strong>效期，過期請回 <Link href="/login" className="underline">登入頁</Link> 重新請求一封新的。請<strong>不要把連結轉貼給別人</strong>（只能本人點一次）。
          </>
        ),
      },
    ],
  },
  {
    title: "訂閱與付款",
    emoji: "💳",
    items: [
      {
        q: "月扣方案會自動扣款嗎？怎麼取消？",
        a: (
          <>
            <strong>會自動續扣</strong>，每 30 天扣一次直到取消。想停請到 <Link href="/my-subscription" className="underline">我的訂閱</Link> 按「取消訂閱」（仍可用到本期結束、不退已扣款）。
            <br />
            年付方案不會自動續，到期前 7 天會收提醒信。
          </>
        ),
      },
      {
        q: "刷卡完成但功能還沒解鎖",
        a: (
          <>
            金流回呼通常在 1-5 分鐘內完成。如果超過 10 分鐘還沒解鎖：
            <ol className="ml-5 list-decimal space-y-1 mt-2">
              <li>先重新整理頁面 / 重新登入</li>
              <li>檢查 email 有沒有收到「付款成功」通知信</li>
              <li>仍未解鎖請聯絡客服，附上信用卡末 4 碼 + 刷卡時間</li>
            </ol>
          </>
        ),
      },
      {
        q: "月扣跟年付差別？",
        a: (
          <>
            月扣 = 每月自動續扣，要主動取消才停。年付 = 一次付一年、到期不自動續、可享折扣。看詳細費率到 <Link href="/pricing" className="underline">方案頁</Link>。
          </>
        ),
      },
      {
        q: "可以中途升級 / 降級方案嗎？",
        a: (
          <>
            可以升級。在 <Link href="/pricing" className="underline">方案頁</Link> 點目標方案會自動算 prorate 退款（舊方案未用天數會自動退回信用卡），同時取消舊定期定額。降級請等舊方案到期後再選新方案。
          </>
        ),
      },
    ],
  },
  {
    title: "電子發票",
    emoji: "🧾",
    items: [
      {
        q: "我的發票會怎麼開？",
        a: (
          <>
            付款成功後系統自動開立綠界 B2C 電子發票，寄到註冊 email。設定請到 <Link href="/my-subscription" className="underline">我的訂閱</Link> → 發票偏好。
          </>
        ),
      },
      {
        q: "發票抬頭 / 統編寫錯了",
        a: (
          <>
            <strong>24 小時內</strong>請立刻聯絡客服，我們會作廢重開新發票（這個流程系統自動跑）。
            <br />
            <strong>超過 24 小時</strong>就要走折讓單流程，客服會手動處理（需要 1-3 個工作天）。
          </>
        ),
      },
      {
        q: "沒收到發票通知信",
        a: (
          <>
            先檢查垃圾信件夾跟促銷分頁。如果都沒有，請聯絡客服，我們會手動重寄。發票本身已在<strong>財政部電子發票整合服務平台</strong>有紀錄、不會遺失。
          </>
        ),
      },
    ],
  },
  {
    title: "設計與使用",
    emoji: "🪑",
    items: [
      {
        q: "我儲存的設計不見了",
        a: (
          <>
            如果你<strong>沒登入</strong>就直接設計，資料只存在當下瀏覽器，換裝置 / 清快取就會消失。請<strong>先登入</strong>再儲存，會同步到雲端跨裝置可看（在 <Link href="/account/designs" className="underline">我的設計</Link>）。
          </>
        ),
      },
      {
        q: "手機看不到 3D 模型 / 卡住",
        a: (
          <>
            3D 模型對舊手機 / 舊瀏覽器較吃資源。建議用<strong>桌機 + Chrome / Edge</strong> 或<strong>最新版 iOS Safari</strong>。或試「組裝版」減少 3D 元件數量。
          </>
        ),
      },
      {
        q: "列印 PDF 跑出空白頁",
        a: (
          <>
            請用 <strong>Chrome 列印 → 另存 PDF</strong>，邊界設「無」，背景圖形勾起來。其他瀏覽器排版可能不準。
          </>
        ),
      },
    ],
  },
  {
    title: "桌面 App 安裝（PWA）",
    emoji: "📲",
    items: [
      {
        q: "怎麼把 App 裝到手機桌面 / 電腦",
        a: (
          <>
            登入後右上選單會出現「<strong>📲 安裝 App 到主畫面</strong>」。第一次進站後可能要互動幾秒才會出現。
            <br />
            <strong>iOS Safari</strong>：點下方分享按鈕 ⬆️ → 加到主畫面（必須用 Safari、不能用 Chrome）。
            <br />
            <strong>Android / 桌面 Chrome / Edge</strong>：直接按按鈕。
            <br />
            <strong>Line / FB 內建瀏覽器</strong>：不支援，請改用系統瀏覽器。
          </>
        ),
      },
    ],
  },
  {
    title: "退費",
    emoji: "↩️",
    items: [
      {
        q: "可以退費嗎？",
        a: (
          <>
            木作藍圖屬於 <strong>數位虛擬商品</strong>，依《通訊交易解除權合理例外情事適用準則》第 5 條，
            付款完成後 <strong>原則上恕不退費</strong>（你在結帳時也勾選了「同意拋棄七日鑑賞期」）。
            <br /><br />
            但以下情形可來信申請<strong>個案處理</strong>：
            <ul className="ml-5 list-disc space-y-1 mt-2">
              <li>系統重大瑕疵導致<strong>無法使用</strong>（且我們無法 7 個工作天內修復）</li>
              <li>因本公司主動終止服務，導致已付費期間未使用之部分</li>
              <li>其他符合消保法強制規定的情形</li>
            </ul>
            <p className="mt-3">
              詳細條款看 <Link href="/refund" className="underline">退費政策頁</Link>。
              申請方式：email 寄到 {" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
              {" "}主旨「退費申請 - 註冊 Email」，附訂單編號、付款日期、退費原因。
            </p>
          </>
        ),
      },
      {
        q: "怎樣避免後悔？",
        a: (
          <>
            既然原則上不退費，建議：
            <ul className="ml-5 list-disc space-y-1 mt-2">
              <li>先用<strong>免費版</strong>試做 3 件家具範本，確認用得順手再升級</li>
              <li>不確定要月扣還年扣的話，<strong>先月扣 NT$390</strong> 試一個月，覺得 OK 再轉年付</li>
              <li>月扣可<Link href="/my-subscription" className="underline">隨時取消</Link>，當期權限保留到到期日</li>
            </ul>
          </>
        ),
      },
    ],
  },
];

/**
 * 把 React.ReactNode 遞迴抽純文字——JSON-LD FAQPage.acceptedAnswer 只能放
 * plain string，不能直接塞 JSX。走 props.children 把整棵樹的字串／數字
 * concatenated 起來，跳過 boolean / null / function。
 */
function textFromNode(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return props ? textFromNode(props.children) : "";
  }
  return "";
}

export default function HelpPage() {
  // FAQPage JSON-LD — Google FAQ rich result，問答數量沒上限但前 ~10 個最有效
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SECTIONS.flatMap((sec) =>
      sec.items.map((qa) => ({
        "@type": "Question",
        name: qa.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: textFromNode(qa.a).replace(/\s+/g, " ").trim(),
        },
      })),
    ),
  };
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <header className="rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-7">
        <h1 className="font-serif-tc text-3xl font-bold tracking-tight text-amber-950">
          常見問題
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          找不到答案？直接聯絡客服：
          <a
            className="text-amber-800 font-medium hover:underline mx-1"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          或加
          <a
            className="text-emerald-700 font-medium hover:underline mx-1"
            href={LINE_OA_URL}
            target="_blank"
            rel="noopener"
          >
            LINE 官方帳號
          </a>
        </p>
      </header>

      {SECTIONS.map((sec) => (
        <section key={sec.title} className="mt-10">
          <h2 className="font-serif-tc text-xl font-bold text-amber-950 flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-base"
            >
              {sec.emoji}
            </span>
            <span>{sec.title}</span>
          </h2>
          <div className="mt-4 space-y-3">
            {sec.items.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl ring-1 ring-amber-900/10 bg-white overflow-hidden transition-shadow hover:shadow-sm open:shadow-sm"
              >
                <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-zinc-800 hover:bg-amber-50/70 flex items-center justify-between gap-3 transition-colors">
                  <span>{item.q}</span>
                  <span
                    aria-hidden
                    className="text-amber-700 shrink-0 transition-transform group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>
                <div className="border-t border-amber-900/10 px-4 py-3.5 text-sm text-zinc-700 leading-7 bg-amber-50/40">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-12 rounded-2xl bg-amber-100/70 ring-1 ring-amber-400/40 p-6">
        <h2 className="font-serif-tc text-lg font-bold text-amber-950">
          還是沒解決？
        </h2>
        <p className="text-sm text-amber-900 mt-2 leading-relaxed">
          直接寫信給我們，附上你的註冊 email + 出問題的螢幕截圖，3 個工作天內回覆。
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5 text-sm">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 px-4 py-2 text-white font-semibold shadow-sm hover:bg-amber-800 hover:shadow active:scale-[0.98] transition-all"
          >
            ✉️ Email 客服
          </a>
          <a
            href={LINE_OA_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-amber-800 font-semibold ring-1 ring-amber-300 hover:bg-amber-50 active:scale-[0.98] transition-all"
          >
            💬 LINE 官方帳號
          </a>
        </div>
      </section>

      <p className="mt-8 text-xs text-zinc-500 text-center">
        本站連結：
        <Link href="/" className="text-amber-800 hover:underline mx-1">首頁</Link>·
        <Link href="/pricing" className="text-amber-800 hover:underline mx-1">方案</Link>·
        <Link href="/my-subscription" className="text-amber-800 hover:underline mx-1">我的訂閱</Link>·
        <Link href="/refund" className="text-amber-800 hover:underline mx-1">退費</Link>·
        <Link href="/privacy" className="text-amber-800 hover:underline mx-1">隱私權</Link>·
        <Link href="/terms" className="text-amber-800 hover:underline mx-1">使用條款</Link>
      </p>
      <p className="mt-2 text-xs text-zinc-400 text-center">
        {SITE_URL.replace(/^https?:\/\//, "")}
      </p>
    </main>
  );
}
