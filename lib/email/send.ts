/**
 * Resend wrapper：所有 transactional email 從這走。
 *
 * Env vars:
 *   RESEND_API_KEY  — Resend API key（在 https://resend.com/api-keys 拿）
 *   EMAIL_FROM      — 寄件人 email，如 "木頭仁工程圖 <noreply@designer.woodenren.com>"
 *                     （designer.woodenren.com 須在 Resend DNS verified）
 *
 * 沒設 RESEND_API_KEY 時 sendEmail 不會炸、會 log warn + return ok=false，
 * dev 環境可以直接寫 log（避免 cron job 因 email 失敗整個炸掉）。
 */
import { Resend } from "resend";

const FROM_DEFAULT =
  process.env.EMAIL_FROM ?? "木頭仁工程圖 <noreply@designer.woodenren.com>";

let _client: Resend | null = null;
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  /** Plain-text 版本（防 spam + 沒 HTML render 時 fallback） */
  text: string;
  /** HTML 版本（rich content） */
  html: string;
  from?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY 未設、跳過寄送", {
      to: opts.to,
      subject: opts.subject,
    });
    return { ok: false, error: "email_disabled" };
  }
  try {
    const { data, error } = await client.emails.send({
      from: opts.from ?? FROM_DEFAULT,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    if (error) {
      console.error("[email] resend send error", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error("[email] sendEmail exception", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
