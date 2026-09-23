import { getTranslations } from "next-intl/server";

export default async function DesignLoading() {
  const t = await getTranslations("designLoading");
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-32 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-700" />
      <h2 className="mt-6 text-lg font-medium text-zinc-700">{t("h2")}</h2>
      <p className="mt-2 text-sm text-zinc-500">{t("body")}</p>
    </main>
  );
}
