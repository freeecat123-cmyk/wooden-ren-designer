"use client";

interface CollapsibleSectionProps {
  title: string;
  /** 預設展開？預設 false */
  defaultOpen?: boolean;
  /** 右側可選副標（如 "5 件" "12 步"） */
  badge?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  badge,
  children,
}: CollapsibleSectionProps) {
  return (
    <details
      open={defaultOpen}
      className="group bg-white ring-1 ring-amber-900/10 shadow-sm rounded-xl overflow-hidden"
    >
      <summary
        className="flex items-center justify-between min-h-[48px] px-4 py-2.5 cursor-pointer list-none select-none hover:bg-amber-50/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-600 text-xs transition-transform group-open:rotate-90">▶</span>
          <span className="text-base font-semibold text-amber-950">{title}</span>
        </div>
        {badge && (
          <span className="text-[11px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
      </summary>
      <div className="border-t border-amber-900/10 p-4">{children}</div>
    </details>
  );
}
