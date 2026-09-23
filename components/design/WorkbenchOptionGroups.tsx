import React, { type ReactNode } from "react";
import type { OptionSpec } from "@/lib/types";
import { groupWorkbenchSpecs } from "@/lib/design/workbench-groups";
import { groupLabel } from "@/lib/design/option-groups";

export function WorkbenchOptionGroups({ specs, locale, renderField, mobile = false }: {
  specs: OptionSpec[];
  locale: string;
  renderField: (spec: OptionSpec) => ReactNode;
  mobile?: boolean;
}) {
  return <div className="min-w-0 divide-y divide-zinc-200" data-workbench-groups>
    {groupWorkbenchSpecs(specs).map(({ group, meta, specs: fields }) => (
      <details key={group} open={group === "structure"} className="group/workbench min-w-0" data-workbench-group={group}>
        <summary className="flex min-h-[44px] items-center gap-2 py-2 cursor-pointer list-none select-none hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-amber-600">
          <span className={`w-1 h-4 shrink-0 rounded-full ${meta.bar}`} aria-hidden />
          <span className="text-sm font-semibold text-zinc-800 min-w-0 break-words">{groupLabel(meta, locale)}</span>
          <span className="text-xs text-zinc-400">{fields.length}</span>
          <span aria-hidden className="ml-auto shrink-0 text-zinc-400 group-open/workbench:rotate-180">▾</span>
        </summary>
        <div className={mobile ? "min-w-0 space-y-3 pb-4" : "min-w-0 grid grid-cols-2 lg:grid-cols-3 gap-3 pb-4"}>
          {fields.map((spec) => (
            <div key={spec.key} className={`min-w-0 ${!mobile && "wide" in spec && spec.wide ? "col-span-full" : ""}`}>
              {renderField(spec)}
            </div>
          ))}
        </div>
      </details>
    ))}
  </div>;
}
