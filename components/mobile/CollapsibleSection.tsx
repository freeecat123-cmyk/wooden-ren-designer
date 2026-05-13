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
      className="group bg-white border border-zinc-200 rounded-lg overflow-hidden"
    >
      <summary
        className="flex items-center justify-between min-h-[48px] px-4 py-2.5 cursor-pointer list-none select-none hover:bg-zinc-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 transition-transform group-open:rotate-90">▶</span>
          <span className="text-base font-semibold text-zinc-800">{title}</span>
        </div>
        {badge && <span className="text-xs text-zinc-500">{badge}</span>}
      </summary>
      <div className="border-t border-zinc-200 p-4">{children}</div>
    </details>
  );
}
