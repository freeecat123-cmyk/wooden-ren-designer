"use client";

/**
 * Checkbox component for parameter form. The change event bubbles to the
 * parent form's onChange handler (DesignFormShell), which debounces a
 * router.replace({ scroll: false }) URL push.
 *
 * 為什麼不用 form.requestSubmit()：requestSubmit 會觸發 <form method="get">
 * 預設導航 = 整頁 reload + 捲回頂部，繞過 DesignFormShell 的 scroll: false。
 * 純靠 onChange bubble 雖然有 500ms debounce 略延遲，但不再跳頁。
 */
export function AutoSubmitCheckbox({
  name,
  defaultChecked,
  label,
  help,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  help?: string;
}) {
  return (
    <label className="flex items-start gap-1.5 text-xs bg-white border border-zinc-300 rounded px-2 py-1.5 cursor-pointer" title={help}>
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="mt-0.5"
      />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-zinc-800 font-medium truncate">{label}</span>
        {help && <span className="mt-0.5 text-[10px] text-zinc-500 line-clamp-1 hover:line-clamp-none">{help}</span>}
      </div>
    </label>
  );
}
