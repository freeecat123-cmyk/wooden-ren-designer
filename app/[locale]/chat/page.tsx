import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ChatClient from "./ChatClient";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chat" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/chat" },
  };
}

export default function ChatPage() {
  return <ChatClient />;
}
