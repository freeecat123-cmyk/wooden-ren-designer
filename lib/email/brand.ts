/**
 * 寄信的品牌分流（中性品牌 Furniture Blueprints vs 主站 Wooden Ren）。
 *
 * 判斷方式：從中性網域結帳時 app/api/lemon-squeezy/checkout 會在 Lemon Squeezy 的
 * custom_data 帶 `brand: "neutral"`；webhook 收到後用 isNeutralCustomData() 判斷，
 * 信件內容跑 neutralizeEmail()、寄件人改用 FROM_NEUTRAL。主站下的單完全不受影響。
 *
 * ⚠️ 寄件人網域：Resend 只能用驗證過 DNS 的網域寄信，furniture-blueprints.vercel.app
 *    是 Vercel 的網域、無法加 DNS 記錄 → 在設定 EMAIL_FROM_NEUTRAL（例如
 *    "Furniture Blueprints <noreply@你的中性網域>"）之前，只能沿用 FROM_EN
 *    （寄件地址仍是 @designer.woodenren.com）。
 */
import { NEUTRAL_HOSTS, neutralOrigin } from "@/lib/brand-hosts";
import { neutralizeText } from "@/lib/brand-text";

export function neutralFrom(fallbackFromEn: string): string {
  return process.env.EMAIL_FROM_NEUTRAL ?? fallbackFromEn;
}

export function isNeutralCustomData(custom: Record<string, unknown> | null | undefined): boolean {
  return custom?.brand === "neutral";
}

export interface MailParts {
  subject: string;
  text: string;
  html: string;
}

/** LINE 官方帳號是 Wooden Ren 的（加好友就看到本人），中性信件整行拿掉 */
function stripLine(s: string): string {
  return s
    .replace(/^.*LINE official account:.*\n?/gim, "")
    .replace(/<li>[^<]*LINE official account:.*?<\/li>\s*/gi, "")
    .replace(/<a [^>]*href="https:\/\/lin\.ee\/[^"]*"[^>]*>.*?<\/a>/gi, "");
}

/** 信件三段（subject / text / html）全部中性化；連結換成中性網域 */
export function neutralizeEmail<T extends MailParts>(mail: T, origin: string = neutralOrigin(NEUTRAL_HOSTS[0])): T {
  return {
    ...mail,
    subject: neutralizeText(mail.subject, origin),
    text: neutralizeText(stripLine(mail.text), origin),
    html: neutralizeText(stripLine(mail.html), origin),
  };
}
