import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedDesignViewer } from "./SharedDesignViewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared design", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer",
};
export default async function SharedDesignPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  // Cached HTML/router shells contain no geometry and must reauthorize through the API.
  return <SharedDesignViewer token={token} english={locale === "en"} />;
}
