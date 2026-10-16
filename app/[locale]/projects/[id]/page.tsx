import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projectDetail" });
  // 個人工作區（客戶資料／報價）—— 不給搜尋引擎收錄，理由見 quote/page.tsx 開頭
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ProjectDetailClient projectId={id} />;
}
