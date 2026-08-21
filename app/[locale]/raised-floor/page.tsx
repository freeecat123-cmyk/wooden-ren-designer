/**
 * /raised-floor — 和室架高平台估價工具
 *
 * 雙頭路由:訪客 / 無權限者看銷售頁,有權限者進工具。
 * 權限門檻:canUseRaisedFloorTool plan flag OR 已單買 "raised-floor" 解鎖。
 * admin 永遠可進。
 *
 * (2026-05-27 之前共用 /floor 的鑰匙當 fallback,但 raised-floor 進 ToolId
 * 後改用獨立 flag,讓單買 raised-floor 也能開鎖。)
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedToolsResult } from "@/lib/tool-unlocks";
import { bilingualAlternates } from "@/i18n/metadata";
import { RaisedFloorClient } from "./RaisedFloorClient";
import { RaisedFloorMarketing } from "./RaisedFloorMarketing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.raisedFloor" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: bilingualAlternates("/raised-floor", locale),
  };
}

export default async function RaisedFloorPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string }>;
}) {
  const { intro } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 訪客 → 銷售頁
  if (!user) return <RaisedFloorMarketing status="guest" />;

  // ?intro=1 強制顯示介紹頁（讓 admin/付費用戶也能從 /templates「了解更多」進來）
  if (intro === "1") {
    return <RaisedFloorMarketing status="loggedInNoAccess" />;
  }

  // admin 直通工具
  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return <RaisedFloorClient />;
  }

  // 已登入:plan 含 canUseRaisedFloorTool OR 已單買 "raised-floor" 解鎖 → 工具
  const { data: profile, error: profileErr } = await supabase
    .from("users")
    .select("plan,subscription_status,subscription_expires_at,student_expires_at")
    .eq("id", user.id)
    .single();
  const planAllows = canUseFeature(
    profile as UserPlanProfile | null,
    "canUseRaisedFloorTool",
  );
  const unlockResult = await fetchUnlockedToolsResult(createAdminClient(), user.id);
  const boughtUnlock = unlockResult.tools.includes("raised-floor");
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
    console.error("[raised-floor] 讀取權限失敗,不當成沒權限", {
      userId: user.id,
      profileErr: profileErr?.message,
      unlockFetchFailed: unlockResult.failed,
    });
    throw new Error("暫時無法確認你的方案狀態,請稍後再試一次。");
  }

  if (!planAllows && !boughtUnlock) {
    return <RaisedFloorMarketing status="loggedInNoAccess" />;
  }
  return <RaisedFloorClient />;
}
