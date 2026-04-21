"use client";

/**
 * Checkbox that auto-submits its enclosing <form> when toggled. Used for
 * parent checkboxes that gate dependent sub-options: flipping the checkbox
 * re-renders the form with the newly-visible (or newly-hidden) fields,
 * without the user needing to click "重新生成" first.
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
    <label className="flex items-start gap-2 text-xs bg-white border border-zinc-300 rounded px-3 py-2 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="mt-0.5"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
      <div className="flex flex-col">
        <span className="text-zinc-800 font-medium">{label}</span>
        {help && <span className="mt-0.5 text-[10px] text-zinc-500">{help}</span>}
      </div>
    </label>
  );
}
