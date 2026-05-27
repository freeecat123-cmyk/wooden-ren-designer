import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { SURVEYS } from "@/lib/survey/configs";
import { SurveysAdminClient } from "@/components/admin/SurveysAdminClient";

export const metadata = {
  title: "問卷分析 · 木頭仁 admin",
};

export default async function AdminSurveysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?admin_denied=1");
  }

  const svc = getServiceSupabase();
  // 撈所有 survey + 對應 responses
  const { data: responses } = await svc
    .from("survey_responses")
    .select("survey_id, user_id, answers, created_at, coupon_code")
    .order("created_at", { ascending: false });

  // 撈 user email 對照（admin 看誰填的）
  const userIds = Array.from(new Set((responses ?? []).map((r) => r.user_id as string)));
  let emailMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: users } = await svc
      .from("users")
      .select("id, email")
      .in("id", userIds);
    emailMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.email]));
  }

  // 撈 coupons 統計
  const { data: coupons } = await svc
    .from("survey_coupons")
    .select("survey_id, used");
  const couponStats: Record<string, { issued: number; used: number }> = {};
  for (const c of coupons ?? []) {
    const sid = c.survey_id as string;
    if (!couponStats[sid]) couponStats[sid] = { issued: 0, used: 0 };
    couponStats[sid].issued++;
    if (c.used) couponStats[sid].used++;
  }

  const surveysWithStats = Object.values(SURVEYS).map((cfg) => {
    const rs = (responses ?? []).filter((r) => r.survey_id === cfg.id);
    return {
      config: cfg,
      responseCount: rs.length,
      responses: rs.map((r) => ({
        userId: r.user_id as string,
        email: emailMap[r.user_id as string] ?? "(no email)",
        answers: r.answers as Record<string, unknown>,
        createdAt: r.created_at as string,
        couponCode: r.coupon_code as string | null,
      })),
      coupons: couponStats[cfg.id] ?? { issued: 0, used: 0 },
    };
  });

  return <SurveysAdminClient surveys={surveysWithStats} />;
}
