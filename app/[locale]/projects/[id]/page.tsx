import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projectDetail" });
  return { title: t("metaTitle") };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ProjectDetailClient projectId={id} />;
}
