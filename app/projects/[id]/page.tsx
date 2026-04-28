import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";

export const metadata = {
  title: "專案詳情 · 木頭仁工程圖生成器",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetailClient projectId={id} />;
}
