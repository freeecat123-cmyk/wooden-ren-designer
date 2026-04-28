import { ProjectsClient } from "@/components/projects/ProjectsClient";
import { createClient } from "@/lib/supabase/server";
import type { ProjectRow } from "@/lib/projects/types";

export const metadata = {
  title: "我的專案 · 木頭仁工程圖生成器",
};

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
