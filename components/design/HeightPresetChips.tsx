"use client";

export function HeightPresetChips({
  presets,
  maxHeight,
}: {
  presets: { value: number; label: string }[];
  /** 該家具的 limits.height；超過上限的 chip 不顯示，避免一鍵就違規 */
  maxHeight?: number;
}) {
  const valid = maxHeight ? presets.filter((p) => p.value <= maxHeight) : presets;
  if (valid.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1 text-zinc-500">
      <span className="text-zinc-500">高度</span>
      {valid.map((p) => (
        <button
          key={`${p.label}-${p.value}`}
          type="button"
          onClick={() => {
            const input = document.querySelector<HTMLInputElement & {
              _valueTracker?: { setValue: (v: string) => void };
            }>('input[name="height"]');
            if (!input) return;
            // React 18+ 的 _valueTracker 記住上一次的值，若 DOM 值改了但
            // tracker 認為「沒變」就不 fire synthetic onChange → ClampedNumberInput
            // 的內部 state 不會跟著更新 → 使用者看到 input 顯示舊值，要等
            // server re-render（URL push 後 600ms+roundtrip）remount 才同步。
            // 重置 tracker 強制視為「值有變」即可。
            input._valueTracker?.setValue("");
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            setter?.call(input, String(p.value));
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }}
          className="h-7 px-2 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] leading-none font-medium"
        >
          {p.label}{p.value}
        </button>
      ))}
    </span>
  );
}
