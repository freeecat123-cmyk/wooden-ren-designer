"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700"
    >
      🖨️ 列印 / 存成 PDF
    </button>
  );
}
