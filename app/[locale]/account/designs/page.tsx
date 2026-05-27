import { MyDesignsClient } from "@/components/MyDesignsClient";

export const metadata = {
  title: "我的設計 · 木頭仁 木作藍圖",
  description:
    "你在木頭仁 木作藍圖儲存的家具設計清單——尺寸、木材、樣式、估價、PDF 一鍵打開繼續做。",
  alternates: { canonical: "/account/designs" },
};

export default function MyDesignsPage() {
  return <MyDesignsClient />;
}
