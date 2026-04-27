import type { Metadata } from "next";
import { PricingClient } from "@/components/PricingClient";

export const metadata: Metadata = {
  title: "方案與訂閱｜木頭仁工程圖生成器",
  description:
    "個人 290、專業 890、學員 2 年免費。月付 / 年付兩種選擇，從免費試用到接案專業版。木頭仁木匠學院出品。",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "方案與訂閱｜木頭仁工程圖生成器",
    description:
      "個人 290、專業 890、學員 2 年免費。月付 / 年付兩種選擇，從免費試用到接案專業版。",
    url: "/pricing",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
