import { ProjectsClient } from "@/components/projects/ProjectsClient";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import type { ProjectRow } from "@/lib/projects/types";

export const metadata = {
  title: "我的專案 · 木頭仁 木作藍圖",
};

export default async function ProjectsPage() {
  // session 取自 cookie（middleware 已驗 JWT），無 HTTP roundtrip
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
