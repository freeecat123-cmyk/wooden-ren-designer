import { FURNITURE_CATALOG } from "../lib/templates";
import { SPEC_HELP_EN } from "../lib/templates/spec-labels";
const use = new Map<string, { n: number; help: string }>();
for (const e of FURNITURE_CATALOG as any[])
  for (const s of (e.optionSchema ?? []) as any[]) {
    if (!s?.help || SPEC_HELP_EN[s.key]) continue;
    const cur = use.get(s.key);
    if (cur) cur.n++;
    else use.set(s.key, { n: 1, help: String(s.help) });
  }
const rows = [...use.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
console.log("missing:", rows.length);
for (const [k, v] of rows) console.log(`${v.n}\t${k}\t${v.help.replace(/\n/g, " ")}`);
