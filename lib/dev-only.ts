import { headers } from "next/headers";

/**
 * 開發用閘門：localhost / 127.0.0.1 才回 true。
 * 用來把還沒完工的功能 (零件圖等) 只暴露在本機開發環境，
 * 部署到 designer.woodenren.com 上自動隱藏。
 */
export async function isLocalhost(): Promise<boolean> {
  const h = await headers();
  const host = h.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}
