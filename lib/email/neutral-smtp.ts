/**
 * 中性品牌（Furniture Blueprints）專用寄信管道：Gmail SMTP。
 *
 * 為什麼不用 Resend：Resend 只能用驗過 DNS 的網域寄信，中性網域是 *.vercel.app
 * 加不了 DNS 記錄，硬寄只能用 @designer.woodenren.com 寄件人 → 直接露餡。
 * 所以中性網域的登入信 / 歡迎信改用 furnitureblueprints@gmail.com 的 Gmail SMTP。
 *
 * 環境變數：
 *   NEUTRAL_SMTP_USER  Gmail 帳號（furnitureblueprints@gmail.com）
 *   NEUTRAL_SMTP_PASS  Gmail「應用程式密碼」（16 碼，不是登入密碼）
 *
 * ⚠️ 只在 server 端 import（nodemailer 依賴 node:net / node:tls）。
 * ⚠️ Gmail 個人帳號每天約 500 封上限；超過會被暫停寄信 24 小時。
 */
import nodemailer from "nodemailer";
import { NEUTRAL_BRAND_NAME } from "@/lib/brand-hosts";

export interface NeutralMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface NeutralSendResult {
  ok: boolean;
  error?: string;
}

export function neutralSmtpConfigured(): boolean {
  return !!(process.env.NEUTRAL_SMTP_USER && process.env.NEUTRAL_SMTP_PASS);
}

/** 寄件人顯示：Furniture Blueprints <furnitureblueprints@gmail.com> */
export function neutralSmtpFrom(): string {
  return `${NEUTRAL_BRAND_NAME} <${process.env.NEUTRAL_SMTP_USER ?? ""}>`;
}

export async function sendNeutralEmail(mail: NeutralMail): Promise<NeutralSendResult> {
  const user = process.env.NEUTRAL_SMTP_USER;
  const pass = process.env.NEUTRAL_SMTP_PASS;
  if (!user || !pass) {
    console.warn("[neutral-smtp] NEUTRAL_SMTP_USER / NEUTRAL_SMTP_PASS 未設、跳過寄送");
    return { ok: false, error: "email_disabled" };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
      // serverless 函式有執行時間上限，連不上就快點失敗，不要卡到被平台砍掉
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transporter.sendMail({
      from: neutralSmtpFrom(),
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[neutral-smtp] 寄信失敗", { to: mail.to, msg });
    return { ok: false, error: msg };
  }
}
