/**
 * /raised-floor/quote — 和室架高平台工程報價(預覽/設定頁)
 *
 * 共用 /floor 的權限門檻(canUseFloorTool / 已解鎖 "floor")。
 * URL query: ?d=<base64 RaisedFloorInput>
 */
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
import { computeRaisedFloorBom } from "@/lib/raised-floor/calc";
import {
  DEFAULT_RAISED_FLOOR_INPUT,
  type RaisedFloorInput,
} from "@/lib/raised-floor/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { raisedFloorBomToEngInput } from "@/lib/raised-floor/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { RaisedFloorOverviewSvg } from "@/lib/raised-floor/RaisedFloorOverviewSvg";
import { RaisedFloorQuoteClient } from "./RaisedFloorQuoteClient";

export const metadata = {
  title: "和室架高平台 工程報價 · 木頭仁",
};

export default async function RaisedFloorQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/raised-floor/quote")}`);
  }

  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    const planAllows = canUseFeature(
      profile as UserPlanProfile | null,
      "canUseFloorTool",
    );
    const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
    const boughtUnlock = unlockedTools.includes("floor");
    if (!planAllows && !boughtUnlock) {
      redirect("/pricing?upgrade=floor");
    }
  }

  const { d } = await searchParams;
  let input: RaisedFloorInput = DEFAULT_RAISED_FLOOR_INPUT;
  if (d) {
    try {
      input = decodeState<RaisedFloorInput>(d);
    } catch {
      input = DEFAULT_RAISED_FLOOR_INPUT;
    }
  }

  const bom = computeRaisedFloorBom(input);
  const engInput = raisedFloorBomToEngInput(bom, ENGINEERING_QUOTE_DEFAULTS);

  return (
    <RaisedFloorQuoteClient
      encodedSimInput={d ?? ""}
      overview={
        <div className="w-full max-w-sm">
          <RaisedFloorOverviewSvg bom={bom} width={360} />
        </div>
      }
      base={{
        pingShu: engInput.pingShu,
        areaM2: engInput.areaM2,
        materialCost: engInput.materialCost,
        materialLines: engInput.materialLines,
      }}
    />
  );
}
