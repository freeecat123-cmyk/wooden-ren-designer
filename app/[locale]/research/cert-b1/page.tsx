import { notFound } from "next/navigation";
import { AssemblyPreview } from "./AssemblyPreview";
import styles from "./study.module.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function CertB1StudyPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className={styles.study}>
    <header><h1>家具木工乙級第一題：板件核對</h1>
      <p role="status">開發中，非施工模型。已拆分板件；鳩尾榫、框架接合及五金尚未完成驗證。</p></header>
    <AssemblyPreview />
    <dl className={styles.dimensions}>
      <div><dt>成品外廓</dt><dd>450 × 450 × 450 mm</dd></div>
      <div><dt>腳架寬／深</dt><dd>410 × 410 mm</dd></div>
      <div><dt>腳柱截面</dt><dd>45 × 32 mm</dd></div>
      <div><dt>抽屜外側寬／深</dt><dd>340 × 350 mm</dd></div>
    </dl>
    <p>木作藍圖自行繪製的練習圖，尺寸參考題號 01200-100201；非官方圖面。此頁僅限本機開發環境。</p>
  </main>;
}
