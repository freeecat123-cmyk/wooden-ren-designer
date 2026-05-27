import { MySubscriptionClient } from "@/components/MySubscriptionClient";

export const metadata = {
  title: "我的訂閱 · 木頭仁 木作藍圖",
  description:
    "查看當前方案、到期日、發票紀錄、付款方式，以及綠界 ECPay 訂閱管理入口。",
  alternates: { canonical: "/my-subscription" },
};

export default function MySubscriptionPage() {
  return <MySubscriptionClient />;
}
