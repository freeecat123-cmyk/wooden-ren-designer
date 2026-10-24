"use client";

/**
 * client 端品牌 Context。app/[locale]/layout.tsx 用 server 的 getBrand() 結果包一層，
 * client 元件用 useBrand() / useIsNeutralBrand() 決定要不要顯示 Wooden Ren 專屬的東西
 * （社群連結、Telegram 師傅、木匠商城 QR…）。
 *
 * 預設值 "woodenren"：沒包 Provider 的地方（例如測試）一律走主站原行為。
 */
import { createContext, useContext, type ReactNode } from "react";
import type { Brand } from "@/lib/brand-hosts";

const BrandContext = createContext<Brand>("woodenren");

export function BrandProvider({ brand, children }: { brand: Brand; children: ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}

export function useIsNeutralBrand(): boolean {
  return useContext(BrandContext) === "neutral";
}
