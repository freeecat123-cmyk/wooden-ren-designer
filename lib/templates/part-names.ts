/**
 * Part-name EN translation by part.id.
 *
 * Part objects only carry nameZh (templates generate it). For /en we look up
 * the part.id in this map; if nothing matches, we run a few regex rules
 * (position suffixes / numeric indices), and finally fall back to nameZh —
 * mixed-language is OK because the surrounding chrome is already English.
 *
 * Maintenance: when adding a new template, the common bases (apron / leg /
 * stretcher / shelf / drawer-*) below should already cover most parts. Add a
 * specific entry here only when the generic pattern isn't enough.
 */

import type { Part } from "@/lib/types";

const ID_EN: Record<string, string> = {
  // Aprons
  "apron-front": "Front apron",
  "apron-back": "Back apron",
  "apron-left": "Left apron",
  "apron-right": "Right apron",

  // Legs / feet
  "leg-l-f": "Front-left leg",
  "leg-l-b": "Back-left leg",
  "leg-r-f": "Front-right leg",
  "leg-r-b": "Back-right leg",
  "foot-front": "Front foot",
  "foot-back": "Back foot",
  "foot-left": "Left foot",
  "foot-right": "Right foot",

  // Stretchers
  "stretcher-front": "Front stretcher",
  "stretcher-back": "Back stretcher",
  "stretcher-left": "Left stretcher",
  "stretcher-right": "Right stretcher",
  "stretcher-center": "Center stretcher",

  // Top / seat
  top: "Top",
  seat: "Seat",
  "seat-panel": "Seat panel",
  "top-panel": "Top panel",

  // Carcase
  "side-left": "Left side panel",
  "side-right": "Right side panel",
  "side-l": "Left side panel",
  "side-r": "Right side panel",
  "top-board": "Top panel",
  "bottom-board": "Bottom panel",
  bottom: "Bottom panel",
  "back-panel": "Back panel",
  "back-panel-inlay": "Back panel inlay",
  "back-panel-raised": "Back panel (raised)",
  back: "Back",

  // Frame
  "frame-top": "Top frame rail",
  "frame-bottom": "Bottom frame rail",
  "frame-left": "Left frame stile",
  "frame-right": "Right frame stile",

  // Back rails / splat
  "back-rail": "Back rail",
  "back-top-rail": "Back top rail",
  "back-upper-rail": "Back upper rail",
  "back-lower-rail": "Back lower rail",
  "back-splat": "Back splat",
  "back-curved-splat": "Curved back splat",

  // Drawer parts
  "drawer-back": "Drawer back",
  "drawer-floor": "Drawer floor",
  "drawer-bottom-rail": "Drawer bottom rail",
  "lower-shelf": "Lower shelf",
  shelf: "Shelf",

  // Doors
  door: "Door",
  glass: "Glass panel",

  // Misc
  base: "Base",
  brace: "Brace",
  column: "Column",
  cornice: "Cornice",
  "cornice-front": "Cornice (front)",
  divider: "Divider",
  "divider-1": "Divider 1",
  "divider-2": "Divider 2",
  footboard: "Footboard",
  headboard: "Headboard",
  "french-cleat": "French cleat",
  "frieze-panel-front": "Frieze panel (front)",
  "front-lower-rail": "Front lower rail",
  "front-upper-rail": "Front upper rail",
  "gallery-back": "Gallery (back)",
  "hat-rail": "Hat rail",
  "head-arch-top": "Head arch top",
  "head-crest": "Head crest",
  "head-panel": "Head panel",
  "head-top-rail": "Head top rail",
  "head-bot-rail": "Head bottom rail",
  "inner-tray": "Inner tray",
  "lazy-susan": "Lazy Susan",
  lid: "Lid",
  "lid-plug": "Lid plug",
  "ledger-left": "Left ledger",
  "ledger-right": "Right ledger",
  "floor-tray": "Floor tray",
};

// Capitalize a string like "foo bar" → "Foo bar"
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Default fallback: hyphenated id → spaced English (best-effort).
// "apron-1" → "Apron 1", "leg-1" → "Leg 1", "back-rail-2" → "Back rail 2"
function idToSpaced(id: string): string {
  return cap(id.replace(/-/g, " "));
}

export function partName(part: Part, locale: string): string {
  if (locale !== "en") return part.nameZh;
  const direct = ID_EN[part.id];
  if (direct) return direct;

  // Numeric-suffix pattern: "apron-3" → look up "apron-front" base name + index
  const numMatch = /^([a-z][a-z-]*?)-(\d+)$/.exec(part.id);
  if (numMatch) {
    const base = numMatch[1];
    const idx = numMatch[2];
    const baseEn = ID_EN[base] ?? ID_EN[`${base}-1`] ?? cap(base.replace(/-/g, " "));
    return `${baseEn} ${idx}`;
  }

  // Position-suffix pattern: "leg-l-f-2" or "leg-l-b"
  // Catch the most common chair / table leg layout
  if (/^leg-[lr]-[fb]$/.test(part.id)) {
    const [, lr, fb] = /^leg-([lr])-([fb])$/.exec(part.id) ?? [];
    const lrEn = lr === "l" ? "left" : "right";
    const fbEn = fb === "f" ? "front" : "back";
    return `${cap(fbEn)}-${lrEn} leg`;
  }

  // Fallback: hyphenated id → spaced English.
  return idToSpaced(part.id);
}
