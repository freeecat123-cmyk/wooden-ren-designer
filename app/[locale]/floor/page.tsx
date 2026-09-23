/**
 * /floor — 地板施工模擬器
 *
 * 雙頭路由:訪客 / 無權限者看銷售頁,有權限者進工具。
 * admin 永遠可進。
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedToolsResult } from "@/lib/tool-unlocks";
import { bilingualAlternates } from "@/i18n/metadata";
import { FloorDevClient } from "./FloorDevClient";
import { FloorMarketing } from "./FloorMarketing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.floor" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: bilingualAlternates("/floor", locale),
  };
}

export default async function FloorPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string }>;
}) {
  const { intro } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <FloorMarketing status="guest" />;

  if (intro === "1") {
    return <FloorMarketing status="loggedInNoAccess" />;
  }

  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return <FloorDevClient />;
  }

  const { data: profile, error: profileErr } = await supabase
    .from("users")
    .select("plan,subscription_status,subscription_expires_at,student_expires_at")
    .eq("id", user.id)
    .single();
  const planAllows = canUseFeature(profile as UserPlanProfile | null, "canUseFloorTool");
  const unlockResult = await fetchUnlockedToolsResult(createAdminClient(), user.id);
  const boughtUnlock = unlockResult.tools.includes("floor");
  /**
   * ⛔ 「查不到」不等於「沒買過」。
   *    supabase 查詢失敗不會 throw,而是回 `{ data: null, error }`。
   *    原本只解構 data → profile 變 null → canUseFeature(null) 判成免費版
   *    → **對已經付費的客戶顯示銷售頁**,他會以為自己買的東西不見了。
   *    解鎖清單那邊也一樣(fetchUnlockedTools 把 failed 旗標丟掉了)。
   *    資料庫抖一下就會發生,而且不會留下任何線索。
   *
   *    這裡故意 throw 讓 app/[locale]/error.tsx 接手:顯示「暫時無法讀取」比
   *    謊稱他沒有權限好。⚠️不可以改成放行——那會變成 DB 一壞就人人有權限。
   */
  if (profileErr || unlockResult.failed) {
    console.error("[floor] 讀取權限失敗,不當成沒權限", {
      userId: user.id,
      profileErr: profileErr?.message,
      unlockFetchFailed: unlockResult.failed,
    });
    throw new Error("暫時無法確認你的方案狀態,請稍後再試一次。");
  }

  if (!planAllows && !boughtUnlock) {
    return <FloorMarketing status="loggedInNoAccess" />;
  }
  return <FloorDevClient />;
}
