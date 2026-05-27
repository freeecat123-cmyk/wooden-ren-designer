import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl">{t("emoji")}</div>
      <h1 className="mt-4 text-2xl font-semibold">{t("h1")}</h1>
      <p className="mt-2 text-zinc-600">{t("body")}</p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-zinc-900 px-6 py-3 text-white hover:bg-zinc-700"
      >
        {t("home")}
      </Link>
    </main>
  );
}
