import type { Metadata } from "next";
import ChatClient from "./ChatClient";

export const metadata: Metadata = {
  title: "木頭仁 AI 木工大師 · 24h 木工問答客服",
  description:
    "問木工問題的 AI 客服，背後是木頭仁本人 19 份知識庫——榫卯、木材、塗裝、安全、機械、修補、明式家具、Windsor 椅、雕刻、車旋全包。",
};

export default function ChatPage() {
  return <ChatClient />;
}
