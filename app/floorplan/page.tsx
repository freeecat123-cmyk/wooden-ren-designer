import { createClient } from "@/lib/supabase/server";
import { FloorplanClient } from "@/components/floorplan/FloorplanClient";
import type { FloorplanDesignRow } from "@/lib/floorplan/types";

export const metadata = {
  title: "室內配置 (Beta) · 木頭仁工程圖生成器",
};

export default async function FloorplanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let designs: FloorplanDesignRow[] = [];
  if (user) {
    const { data } = await supabase
      .from("designs")
      .select("id, furniture_type, name, params, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    designs = (data ?? []) as FloorplanDesignRow[];
  }

  return <FloorplanClient initialDesigns={designs} isLoggedIn={!!user} />;
}
