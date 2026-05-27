/**
 * POST /api/lemon-squeezy/checkout
 *
 * 建 LS checkout session 後 302 跳轉。前端按鈕直接 POST 過來，不用 await JSON。
 *
 * Body / Query 參數：
 *   type=sub_monthly | sub_yearly | lifetime | single_template
 *   template_id=stool|...|ceiling|floor  (僅 type=single_template 必填)
 *
 * 認證：要 Supabase login user（webhook 對帳要 user_id）。
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createLifetimeCheckout,
  createSingleTemplateCheckout,
  createSubscriptionCheckout,
} from "@/lib/lemon-squeezy/checkout";
import {
  getTemplateTier,
  isSellableFurniture,
  isSellableTool,
} from "@/lib/lemon-squeezy/tier-map";
import { checkLemonSqueezyConfig } from "@/lib/lemon-squeezy/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutType = "sub_monthly" | "sub_yearly" | "lifetime" | "single_template";

async function handle(req: NextRequest, params: URLSearchParams): Promise<Response> {
  const missing = checkLemonSqueezyConfig();
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Lemon Squeezy not configured: ${missing.join(", ")}` },
      { status: 500 },
    );
  }

  const type = params.get("type") as CheckoutType | null;
  if (!type) {
    return NextResponse.json({ error: "Missing ?type" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  // 從 referer 抓 locale（zh-TW / en），給 webhook 寄信用
  const referer = req.headers.get("referer") ?? "";
  const localeMatch = referer.match(/\/(zh-TW|en)\b/);
  const locale = localeMatch?.[1] ?? "en";

  // success URL 帶回 /[locale]/my-subscription
  // ⚠️ 原本指 /account 但該 page 不存在(只有 /account/designs),會 404。
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const successUrl = `${origin}/${locale}/my-subscription?checkout=success`;

  const baseOpts = {
    customerEmail: user.email ?? undefined,
    customerName: (user.user_metadata?.name as string | undefined) ?? undefined,
    successUrl,
    customData: { user_id: user.id, locale },
  };

  try {
    let checkoutUrl: string;
    if (type === "sub_monthly") {
      checkoutUrl = await createSubscriptionCheckout("monthly", baseOpts);
    } else if (type === "sub_yearly") {
      checkoutUrl = await createSubscriptionCheckout("yearly", baseOpts);
    } else if (type === "lifetime") {
      checkoutUrl = await createLifetimeCheckout(baseOpts);
    } else if (type === "single_template") {
      const templateId = params.get("template_id");
      if (!templateId) {
        return NextResponse.json({ error: "Missing template_id" }, { status: 400 });
      }
      if (!isSellableFurniture(templateId) && !isSellableTool(templateId)) {
        return NextResponse.json(
          { error: `Template "${templateId}" not sellable individually` },
          { status: 400 },
        );
      }
      const tier = getTemplateTier(
        isSellableTool(templateId)
          ? { kind: "tool", tool: templateId as never }
          : { kind: "furniture", category: templateId as never },
      );
      checkoutUrl = await createSingleTemplateCheckout(tier, templateId, baseOpts);
    } else {
      return NextResponse.json({ error: `Unknown type "${type}"` }, { status: 400 });
    }

    return NextResponse.redirect(checkoutUrl, 303);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ls/checkout] failed", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const params = form
    ? new URLSearchParams(
        Array.from(form.entries()).map(([k, v]) => [k, String(v)]),
      )
    : new URL(req.url).searchParams;
  return handle(req, params);
}

export async function GET(req: NextRequest) {
  return handle(req, new URL(req.url).searchParams);
}
