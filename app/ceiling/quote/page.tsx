import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { computeCeilingBom } from "@/lib/ceiling/calc";
import { DEFAULT_CEILING_INPUT, type CeilingInput } from "@/lib/ceiling/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { ceilingBomToEngInput } from "@/lib/ceiling/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { CeilingOverviewSvg } from "@/lib/ceiling/CeilingOverviewSvg";
import { EngineeringQuoteClient } from "@/components/engineering-quote/EngineeringQuoteClient";

export const metadata = {
  title: "天花板工程報價 · 木頭仁",
};

export default async function CeilingQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent("/ceiling/quote")}`);

  // admin 永遠可進，其他人依 canUseCeilingTool permission
  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    if (!canUseFeature(profile as UserPlanProfile | null, "canUseCeilingTool")) {
      redirect("/pricing?upgrade=ceiling");
    }
  }

  const { d } = await searchParams;
  let input: CeilingInput = DEFAULT_CEILING_INPUT;
  if (d) {
    try {
      input = decodeState<CeilingInput>(d);
    } catch {
      input = DEFAULT_CEILING_INPUT;
    }
  }

  const bom = computeCeilingBom(input);
  // 編輯頁初始 materialPerPing = 0，實際值由 client 的費用表單帶
  const engInput = ceilingBomToEngInput(bom, 0, ENGINEERING_QUOTE_DEFAULTS);

  return (
    <EngineeringQuoteClient
      quoteType="ceiling"
      encodedSimInput={d ?? ""}
      overview={<CeilingOverviewSvg bom={bom} />}
      base={{
        pingShu: engInput.pingShu,
        areaM2: engInput.areaM2,
        materialCost: engInput.materialCost,
        materialLines: engInput.materialLines,
      }}
    />
  );
}
