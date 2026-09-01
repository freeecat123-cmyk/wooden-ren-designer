import fs from "node:fs";
const P = "lib/templates/spec-labels.ts";
const src = fs.readFileSync(P, "utf8");

const zoneCount = "Drawers = number of rows / Doors = number of leaves / Open shelving = number of shelves.";
const cols = "When the zone type is Doors: split this column into N independent sub-cabinets. Sub-column 1 uses the zone-level settings above; sub-columns 2/3/4 are set up separately.";
const drawerH = "Height of each drawer, 80–150mm. The whole drawer bank = number of drawers × this height.";
const subDrawerH = "Height of each drawer.";
const drawers = "Above 0, drawers replace the shelving in this zone (they split the remaining space evenly, with no horizontal dividers).";
const shelves = "When the zone type is Doors: how many shelves are hidden behind the doors (0 = leave it empty).";
const subShelves = "0 = leave it empty.";
const subWidth = "0 = share the remaining space evenly; above 0, use this width (any sub-columns left unspecified split what is left).";

const lines = [];
lines.push("  // === 櫃體三區（上/中/下）共用說明：同一組字串在 top/mid/bottom 各有一份 key ===");
for (const z of ["top", "mid", "bottom"]) {
  const Z = z + "Door";
  lines.push(`  ${z}Count: ${JSON.stringify(zoneCount)},`);
  lines.push(`  ${Z}Cols: ${JSON.stringify(cols)},`);
  lines.push(`  ${Z}DrawerHeight: ${JSON.stringify(drawerH)},`);
  lines.push(`  ${Z}Drawers: ${JSON.stringify(drawers)},`);
  lines.push(`  ${Z}Shelves: ${JSON.stringify(shelves)},`);
  for (const n of [2, 3, 4]) {
    lines.push(`  ${Z}Sub${n}DrawerHeight: ${JSON.stringify(subDrawerH)},`);
    lines.push(`  ${Z}Sub${n}Drawers: ${JSON.stringify(drawers)},`);
    lines.push(`  ${Z}Sub${n}Shelves: ${JSON.stringify(subShelves)},`);
    lines.push(`  ${Z}Sub${n}WidthMm: ${JSON.stringify(subWidth)},`);
  }
}
lines.push("  // === 腳 / 抽屜五金 / 門框 共用說明 ===");
const singles = {
  ctInset: "How far the foot pulls in, as a straight taper down the outer face of the leg. The inner face stays vertical below the cove shoulder.",
  ctSplay: "Outward lean of the whole leg (splayed on the diagonal, as in the splayed-leg family). 0 = vertical. 3–8° is the usual range; steeper than that and the footprint gets very wide.",
  useDrawerSlide: "Checked: the drawer box loses 25mm of total width to make room for the metal slides, and a separate front panel covers the side gaps (2mm all round, same spec as an inset door). The 5-piece box also moves back 18mm — the panel thickness — so it hides behind that front, is 10mm shorter than the opening (5mm of slide clearance top and bottom), and keeps 10mm clear of the back panel. Unchecked: a traditional wooden side-runner drawer with no metal slides.",
  pullStyle: "Pull style drives both the hardware cost and the build steps. Wood-knob is all timber, no metal at all.",
  doorPullStyle: "Door pulls are chosen separately from drawer pulls. A bar pull used on a door is turned vertical automatically.",
  drawerBottomThickness: "A nailed-on bottom hangs under the sides, so this thickness comes off the drawer overall height. A grooved-in bottom sits in a slot in the sides, so the inside clear height drops by (6 + bottom thickness)mm. A 12mm bottom in a shallow drawer (under 80mm) eats a lot of that space.",
  legHeight: "Worked out for you when the overall height is locked — it is whatever is left once the three zones are taken out.",
  withLegs: "Checked: adds a plinth with legs, so you can then set leg height / thickness / style / inset. Unchecked: the cabinet sits straight on the floor (the built-in-cabinetry look).",
  doorFrameRailWidth: "Section width of the muntins in a lattice or glazed door. 15–22mm is traditional Ming and Qing; modern designs go to 30mm and up.",
  doorFrameThickness: "How far the muntins stand proud of the door face. 8mm is a shallow traditional relief; 12mm and up reads far more three-dimensional.",
  liveEdge: "Keeps the natural bark edge along the long sides of the top (the live-edge look — needs one wide slab).",
};
for (const [k, v] of Object.entries(singles)) lines.push(`  ${k}: ${JSON.stringify(v)},`);

const marker = "\n};\n";
const idx = src.indexOf(marker, src.indexOf("export const SPEC_HELP_EN"));
if (idx < 0) throw new Error("找不到 SPEC_HELP_EN 結尾");
const out = src.slice(0, idx + 1) + lines.join("\n") + src.slice(idx + 1);
fs.writeFileSync(P, out);
console.log("inserted", lines.filter((l) => !l.includes("// ===")).length, "entries");
