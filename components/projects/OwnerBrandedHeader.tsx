import type { OwnerBranding } from "@/lib/projects/fetch-quote-data";

/**
 * 純 server component 版的品牌抬頭。
 * 為什麼不用既有的 BrandedHeader：那個是 client component 從 localStorage 讀資料，
 * 客戶（沒帳號）打開分享連結時 localStorage 是空的，會看到木頭仁的預設品牌。
 * 這裡資料由 server 端從 user_branding 撈，直接 render 進 HTML。
 */
export function OwnerBrandedHeader({ branding }: { branding: OwnerBranding }) {
  const name = branding.companyNameZh || "工作室";
  const tagline = branding.tagline || "";
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={branding.logoDataUrl || "/logo.png"}
        alt={name}
        width={56}
        height={56}
        className="object-contain"
      />
      <div>
        {tagline && (
          <p className="text-[10px] tracking-[0.2em] text-zinc-500">
            {tagline}
          </p>
        )}
        <p className="text-lg font-bold">{name}</p>
        <p className="text-[10px] text-zinc-500">QUOTATION · 客製家具報價單</p>
      </div>
    </div>
  );
}

export function OwnerContactBlock({ branding }: { branding: OwnerBranding }) {
  const lines = [
    branding.contact,
    branding.phone,
    branding.email,
    branding.address,
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div className="text-[10px] text-zinc-500 leading-relaxed">
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}
