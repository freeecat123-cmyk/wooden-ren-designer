import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProjectsClient } from "@/components/projects/ProjectsClient";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import type { ProjectRow } from "@/lib/projects/types";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projectsIndex" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/projects" },
  };
}

export default async function ProjectsPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  let initialRows: ProjectRow[] | null = null;
  if (user) {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    initialRows = (data ?? []) as ProjectRow[];
  }

  return <ProjectsClient initialRows={initialRows} />;
}
