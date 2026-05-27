import { getLocale, getTranslations } from "next-intl/server";

/**
 * 報價有效期顯示。雙模式：
 *   publicAccess（客戶版）：紅色橫幅「已過期」或藍色「有效至 X」
 *   師傅版：簡潔倒數，可在 ProjectDetailClient 內進一步加延期按鈕
 */
export async function ExpiryBanner({
  expiresAt,
  publicAccess,
}: {
  expiresAt: string | null;
  publicAccess: boolean;
}) {
  if (!expiresAt) return null;
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "expiryBanner" });
  const exp = new Date(expiresAt);
  const now = new Date();
  const msPerDay = 86400000;
  const diff = Math.ceil((exp.getTime() - now.getTime()) / msPerDay);
  const expIso = exp.toISOString().slice(0, 10);

  if (diff < 0) {
    return (
      <div className="mb-4 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-900 print:hidden">
        <div className="font-semibold">{t("expiredTitleTpl", { date: expIso })}</div>
        {publicAccess ? (
          <div className="text-xs mt-0.5">{t("expiredCustomer")}</div>
        ) : (
          <div className="text-xs mt-0.5">{t("expiredCraftsman")}</div>
        )}
      </div>
    );
  }

  if (diff <= 3) {
    return (
      <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 print:hidden">
        {t("soonTpl", { date: expIso, days: diff })}
      </div>
    );
  }

  return (
    <div className="mb-4 text-[11px] text-zinc-500 print:hidden">
      {t("validTpl", { date: expIso, days: diff })}
    </div>
  );
}
