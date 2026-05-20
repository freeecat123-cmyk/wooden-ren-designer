"use client";

export function HeightPresetChips({
  presets,
}: {
  presets: { value: number; label: string }[];
}) {
  if (presets.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1 text-zinc-500">
      <span className="text-zinc-500">高度</span>
      {presets.map((p) => (
        <button
          key={`${p.label}-${p.value}`}
          type="button"
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>('input[name="height"]');
            if (!input) return;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            setter?.call(input, String(p.value));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }}
          className="h-7 px-2 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] leading-none font-medium"
        >
          {p.label}{p.value}
        </button>
      ))}
    </span>
  );
}
