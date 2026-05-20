/**
 * Resend wrapper：所有 transactional email 從這走。
 *
 * Env vars:
 *   RESEND_API_KEY  — Resend API key（在 https://resend.com/api-keys 拿）
 *   EMAIL_FROM      — 寄件人 email，如 "木頭仁 木作藍圖 <noreply@designer.woodenren.com>"
 *                     （designer.woodenren.com 須在 Resend DNS verified）
 *
 * 沒設 RESEND_API_KEY 時 sendEmail 不會炸、會 log warn + return ok=false，
 * dev 環境可以直接寫 log（避免 cron job 因 email 失敗整個炸掉）。
 */
import { Resend } from "resend";

const FROM_DEFAULT =
  process.env.EMAIL_FROM ?? "木頭仁 木作藍圖 <noreply@designer.woodenren.com>";

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

// 可重試的 Resend 錯誤碼——速率/伺服器暫時性問題。其他（quota_exceeded /
// validation_error 等）retry 也救不了，直接放棄。
const RETRY_ERROR_NAMES = new Set([
  "rate_limit_exceeded",
  "internal_server_error",
  "application_error",
]);
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

  // Exponential backoff retry：第 1 次失敗 wait 500ms、第 2 次 1500ms、第 3 次 4500ms。
  // 突發 burst 撞 Resend 2-10 req/s 速率上限時自動補救，使用者不會掉信。
  let lastError: string = "unknown";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await client.emails.send({
        from: opts.from ?? FROM_DEFAULT,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      if (!error) {
        if (attempt > 0) {
          console.log("[email] retry 成功", { to: opts.to, attempt });
        }
        return { ok: true, id: data?.id };
      }
      lastError = error.message;
      const retryable =
        "name" in error && typeof error.name === "string" && RETRY_ERROR_NAMES.has(error.name);
      if (!retryable || attempt === MAX_RETRIES - 1) {
        console.error("[email] resend send error", { name: (error as { name?: string }).name, message: error.message, attempt });
        return { ok: false, error: error.message };
      }
      const backoffMs = 500 * Math.pow(3, attempt);
      console.warn("[email] resend 暫時失敗,稍後 retry", { name: (error as { name?: string }).name, attempt, backoffMs });
      await sleep(backoffMs);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "unknown";
      // 網路 throw（fetch 失敗等）— 也算暫時性,backoff retry
      if (attempt === MAX_RETRIES - 1) {
        console.error("[email] sendEmail exception", e);
        return { ok: false, error: lastError };
      }
      const backoffMs = 500 * Math.pow(3, attempt);
      console.warn("[email] sendEmail throw,稍後 retry", { attempt, backoffMs, err: lastError });
      await sleep(backoffMs);
    }
  }
  return { ok: false, error: lastError };
}
