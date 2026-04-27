import type { Metadata } from "next";
import { PricingClient } from "@/components/PricingClient";

export const metadata: Metadata = {
  title: "方案 · 木頭仁工程圖生成器",
  description: "從免費試用到專業接案，挑一個適合你的方案。月付 / 年付兩種選擇。",
};

export default function PricingPage() {
  return <PricingClient />;
}
