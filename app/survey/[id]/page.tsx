import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getSurvey } from "@/lib/survey/configs";
import { SurveyClient } from "@/components/survey/SurveyClient";

export const metadata = {
  title: "問卷 · 木頭仁木作藍圖",
};

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = getSurvey(id);
  if (!config) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/survey/${id}`);

  // 已填過 → 直接給 coupon 頁（不能重填，coupon 還在）
  const svc = getServiceSupabase();
  const { data: existing } = await svc
    .from("survey_responses")
    .select("coupon_code, created_at")
    .eq("user_id", user.id)
    .eq("survey_id", id)
    .maybeSingle();

  return <SurveyClient config={config} existingCoupon={existing?.coupon_code ?? null} />;
}
