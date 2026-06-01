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
import { createAdminClient } from "@/lib/supabase/server";

const FROM_DEFAULT =
  process.env.EMAIL_FROM ?? "木頭仁 木作藍圖 <noreply@designer.woodenren.com>";

/**
 * 英文(國際版 / Lemon Squeezy)寄件人。LS 買家收到的確認信內文全英文,
 * 寄件人顯示名也要是英文品牌 "Furniture Blueprints",不能掉回中文 FROM_DEFAULT。
 * 寄 LS 相關信時把這個傳進 sendEmail({ from: FROM_EN, ... })。
 */
export const FROM_EN =
  process.env.EMAIL_FROM_EN ?? "Furniture Blueprints <noreply@designer.woodenren.com>";

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

// retry 全失敗後丟進 email_queue,給 admin 手動撈出來 replay。
// failure_kind 分流：rate_limit / quota / validation / network / unknown
// 用來判斷哪些可以隔天 replay、哪些是永久 fail 不用浪費 quota。
async function enqueueFailedEmail(
  opts: SendEmailOptions,
  failureKind: string,
  error: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("email_queue").insert({
      to_email: opts.to,
      subject: opts.subject,
      text_body: opts.text,
      html_body: opts.html,
      from_email: opts.from ?? null,
      failure_kind: failureKind,
      error: error.slice(0, 1000),
    });
  } catch (e) {
    // queue 寫入失敗最後一道防線：記 log,不再傳染（已 retry 過,quota 也滿了,
    // 此時連 DB 都掛掉的話也只能放棄）
    console.error("[email] email_queue insert failed", e);
  }
}

function classifyFailure(name: string | undefined): string {
  if (!name) return "unknown";
  if (name === "rate_limit_exceeded") return "rate_limit";
  if (name === "daily_quota_exceeded" || name === "monthly_quota_exceeded") return "quota";
  if (name === "internal_server_error" || name === "application_error") return "transient";
  if (name.startsWith("invalid_") || name === "validation_error") return "validation";
  return "unknown";
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
        const errName = (error as { name?: string }).name;
        console.error("[email] resend send error", { name: errName, message: error.message, attempt });
        // validation_error 寫進 queue 也沒用(永遠 replay 不出來),其他都寫
        const failureKind = classifyFailure(errName);
        if (failureKind !== "validation") {
          await enqueueFailedEmail(opts, failureKind, error.message);
        }
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
        await enqueueFailedEmail(opts, "network", lastError);
        return { ok: false, error: lastError };
      }
      const backoffMs = 500 * Math.pow(3, attempt);
      console.warn("[email] sendEmail throw,稍後 retry", { attempt, backoffMs, err: lastError });
      await sleep(backoffMs);
    }
  }
  return { ok: false, error: lastError };
}
