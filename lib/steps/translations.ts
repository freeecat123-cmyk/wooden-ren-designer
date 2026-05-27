/**
 * Build-step EN translations for the visible chrome (title + first-line description).
 *
 * deriveBuildSteps() runs in zh-TW and bakes in dynamic values via template
 * literals — we can't pre-translate the final strings. Instead, this file
 * provides parallel EN renderers that re-build the same step from raw design
 * data, then translateStep() swaps title + description on /en. Bullets and
 * warnings stay zh for now (long-tail instructional content; separate pass).
 *
 * Coverage: ~20 static steps (select-stock / jointer / cut-stock / mark /
 * dry-fit / glue-frame / glue-drawer / glue-door / glue-final / back-panel /
 * shelves / sand × 3 / finish × 3 / hinges / drawer-slide / final-check).
 * Dynamic step-05-N-{joineryType} matched by suffix.
 */

import type { FurnitureDesign, JoineryType } from "@/lib/types";
import type { BuildStep } from "@/lib/steps/derive";
import { materialName } from "@/lib/materials";
import { joineryLabel } from "@/lib/joinery/details";

const JOINERY_STEP_DESC_EN: Record<JoineryType, string> = {
  "through-tenon":
    "Tenon goes all the way through the mortise and is visible on the far side. Cut the tenons first, then the mortises, then dry-fit.",
  "blind-tenon":
    "Tenon stops inside the mortise (depth ≤ 2/3 of mother thickness). Cut tenons first, then mortises, then dry-fit.",
  "shouldered-tenon":
    "Main tenon plus a small haunch above it. Main tenon takes pull-out, haunch resists rotation. Cut tenons first, then mortises, then dry-fit.",
  "stub-joint":
    "Whole end face seats into a same-size pocket in the mate (no shouldered tenon). Used when a shouldered tenon would be hard to cut (e.g., round legs).",
  "half-lap":
    "Each piece is rebated to half its thickness so they overlap flush. Simple frame crossings.",
  dovetail:
    "Trapezoidal tails interlock for very high pull-out strength. Make the tails first, mark the pins from the tails, then dry-fit.",
  "finger-joint":
    "Symmetric square fingers interlock. Cut the comb on one piece first, mark the mate from it.",
  "tongue-and-groove":
    "One face has a tongue, the other a matching groove. Used to edge-join panels.",
  dowel:
    "Loose round dowel pins join the parts. Simple, lower strength than mortise-and-tenon.",
  "mitered-spline":
    "45° miter reinforced with a biscuit or thin spline.",
  mitered:
    "Pure 45° miter with PVA glue, no reinforcement. Picture frames / small decorative frames only.",
  "pocket-hole":
    "Drill 15° pocket holes with a jig, then drive purpose-made screws from the hidden face. Fast — no joinery cutting needed.",
  screw:
    "PVA glue + wood screws driven straight. Screw heads can be counterbored and plugged.",
};

interface OverrideEntry {
  title: (design: FurnitureDesign) => string;
  description: (design: FurnitureDesign) => string;
}

const STEP_OVERRIDE_EN: Record<string, OverrideEntry> = {
  "step-01-select-stock": {
    title: () => "Select and inspect stock",
    description: (design) => {
      const mat = materialName(design.primaryMaterial, "en");
      return `Working in ${mat}. Pick boards with clean, straight grain, no major knots, and stress-released stock (no edge bow). Leave 5–10% trim waste — don't skimp on this buffer for larger projects.`;
    },
  },
  "step-02-jointer-planer": {
    title: () => "Joint and thickness-plane",
    description: () =>
      "Joint one reference face plus one 90° edge (square to the face), then thickness-plane the opposite face parallel to the reference. No jointer / planer? Buy pre-milled (S4S) stock and skip ahead.",
  },
  "step-03-cut-stock": {
    title: (design) => `Cut to length — ${design.parts.length} parts`,
    description: () =>
      "Cut milled stock into individual parts per the cut list. **Note:** parts with tenons already include the tenon stock — don't add length. Mark each part on the side with its part-id (e.g., leg-l-f / apron-front) right after cutting so dry-fit doesn't turn into a guessing game.",
  },
  "step-03b-glue-up-top": {
    title: (design) => `Edge-glue panel — ${design.overall.length} mm top`,
    description: (design) =>
      `A ${design.overall.length} mm diameter top typically needs 3–5 boards (each 150–200 mm wide) edge-glued. Alternate the growth-ring orientation up/down to resist cupping; reinforce the joint line with biscuits or splines; clamp with parallel clamps for 8+ hours before releasing.`,
  },
  "step-03c-cut-circle": {
    title: (design) => `Cut the round top (⌀${design.overall.length} mm)`,
    description: () =>
      "After the glue-up cures, mark center, rough-cut 5 mm proud with a jigsaw, then finish with a router + circle jig (bearing-guided straight bit, ≤3 mm per pass).",
  },
  "step-03d-bent-panels": {
    title: () => "Make bent panels (curved lamination / steam / kerf)",
    description: () =>
      "Three approaches: (A) **Lamination** — saw the panel into 4–6 layers ~5 mm thick, glue with PVA on a form, clamp 8 hours; least springback, most reliable. (B) **Steam bending** — 1 hour per 25 mm of stock in a steam box, then clamp on a form to cool; needs a steam rig. (C) **Kerf bending** — saw N kerfs in the back leaving ~3 mm web, force the curve and glue; simplest but weakest and the kerfs show.",
  },
  "step-04-mark": {
    title: () => "Lay out the joinery (tenons + mortises)",
    description: () =>
      "Mark every tenon and mortise from the joinery detail drawings. Check every layout against the three-view drawings before any saw or chisel touches the wood.",
  },
  "step-05-assembly-prep": {
    title: () => "Mechanical-joinery prep (pocket hole / dowel / DOMINO — pick one)",
    description: () =>
      "Assembly mode replaces traditional joinery with mechanical fasteners. **Pick one method and stick with it** — mixing makes alignment harder. (A) **Pocket holes** (fastest, beginner-friendly): drill 15° holes on the male part (aprons / stretchers / drawer sides) with a jig and drive #6 × 1¼\" screws. (B) **Dowels** (cheapest): drill ⌀8 × 30 mm holes on both parts with a doweling jig, insert 8 × 40 mm dowels + glue. (C) **DOMINO** (most pro, needs a Festool): cut slots with the joiner, insert 5 × 30 mm DOMINOs.",
  },
  "step-05-corner-finger-joint": {
    title: () => "Cut finger joints (4 corners)",
    description: () =>
      "Make the fingers on one wall first, mark the mating wall from it. Alternate finger / groove phase on adjacent walls so they interlock.",
  },
  "step-05-corner-dovetail": {
    title: () => "Cut dovetails (4 corners)",
    description: () =>
      "Make the tails first, transfer the pin layout from the tails, then cut the pins. Hardwood dovetails: 7–9°; softwood: 10–14°. End pieces should be half-pins so corners don't break out.",
  },
  "step-06-dry-fit": {
    title: () => "Dry-fit (no glue)",
    description: () =>
      "Assemble every joint without glue first. Target fit: pushes in by hand, seats with a light mallet tap, takes some effort to pull out. **Pare tenons, never mortises** — mortises are mother structure, you ruin them and the part is scrap.",
  },
  "step-07a-glue-frame": {
    title: () => "Glue up the leg frames (sides first)",
    description: () =>
      "Never glue all four legs at once. Build the left side frame (left front leg + left back leg + left apron), then the right side, let them cure 24 hours, then connect with the front and back aprons. Stage-glue so you're not aligning four tenons in 10 minutes of open time.",
  },
  "step-07b-glue-drawer-box": {
    title: () => "Glue up the drawer boxes",
    description: () =>
      "Each drawer assembled independently. Sequence: glue front + 2 sides (dovetail or half-lap), check for square, attach the back, slide the bottom in from the back — **do not glue the bottom**, it needs to move with seasonal humidity.",
  },
  "step-07c-glue-door": {
    title: () => "Build the doors (frame-and-panel or flat)",
    description: () =>
      "Frame-and-panel: rails + stiles around a floating panel. **Don't glue the panel into the frame** — it must move; leave 2 mm expansion gap. Flat-plywood door: cut to size, edge-band all four sides.",
  },
  "step-08-glue-final": {
    title: () => "Final glue-up (combine sub-assemblies)",
    description: () =>
      "Combine the cured sub-assemblies (frames / drawer boxes / doors) with the main structure (top / sides / back). Thin PVA on tenon walls and inside mortises — 1 mm coat is plenty; thicker just squeezes out and is hard to clean up.",
  },
  "step-09-back-panel": {
    title: () => "Install the back panel",
    description: () =>
      "Slide the back into the rabbet from behind. Plywood backs can be glued; solid-wood backs **don't glue** — they need to move. Tack 18 mm pins around the perimeter from outside.",
  },
  "step-10-shelves": {
    title: () => "Install the shelves",
    description: () =>
      "Fixed shelves: glue + screw into dadoes on the sides. Adjustable shelves: 5 mm shelf pins into pre-drilled holes on the sides.",
  },
  "step-11-sand-coarse": {
    title: () => "Sand pass 1 (120 grit — remove plane marks)",
    description: () =>
      "Use 120 grit to remove plane marks, saw marks, glue residue. **Sand with the grain** — cross-grain scratches will not come out later.",
  },
  "step-12-sand-medium": {
    title: () => "Sand pass 2 (180 grit — refine)",
    description: () =>
      "Move to 180 grit. Fully remove the 120-grit scratches before moving on — leftover scratches show through every finish coat.",
  },
  "step-13-sand-fine": {
    title: () => "Sand pass 3 (240 grit — ready for finish)",
    description: () =>
      "240 grit final pass to prep for oil / finish. Vacuum and wipe with a tack cloth — any dust left will get sealed into the first coat as grit.",
  },
  "step-14-finish-coat-1": {
    title: () => "First oil coat",
    description: () =>
      "Thin coat of wood oil (OSMO Polyx-Oil / Tried-and-True / Watco Danish Oil) with a lint-free rag. Let it sit 15 minutes for the wood to drink, then wipe all surplus off with a clean rag (must wipe, or it dries sticky). Cure 12–24 hours.",
  },
  "step-15-burnish": {
    title: () => "Burnish with 0000 steel wool",
    description: () =>
      "Once coat 1 is fully cured (24 h), burnish the whole surface with 0000 steel wool to knock back raised grain. Wipe clean with a dry rag. This step is what makes the surface feel silky.",
  },
  "step-16-finish-coat-2": {
    title: () => "Second oil coat",
    description: () =>
      "Repeat coat 1: thin coat → 15 min → wipe surplus → 24 h cure. After two coats the surface is noticeably smooth with a warm sheen. Two coats are enough for daily use; high-wear surfaces (tabletops, seats) want a third.",
  },
  "step-17-finish-coat-3": {
    title: () => "Third oil coat (recommended for tabletops / seats)",
    description: () =>
      "High-contact surfaces (dining table, desk, seat) want a third coat. Thin film wears through in months on daily-use surfaces — three coats lasts 2–3 years before re-oiling.",
  },
  "step-18-hinges": {
    title: () => "Install hinges and door pulls",
    description: () =>
      "Euro cup hinges: drill the 35 mm cup with a Forstner bit (12 mm deep) on the door back, fasten the hinge, then screw the plate to the cabinet side. After hanging, fine-tune the 3 adjustment screws (forward-back / left-right / up-down) so reveals are even.",
  },
  "step-19-drawer-slide": {
    title: () => "Install drawer slides (if used)",
    description: () =>
      "Full-extension slides: outer rail to cabinet side, inner rail to drawer side. The two rails must be perfectly horizontal and aligned left/right or the drawer will bind. Traditional wood runners also work.",
  },
  "step-99-final-check": {
    title: () => "Final inspection and sign-off",
    description: () =>
      "Once all glue and oil are fully cured (~72 hours total), do a final check.",
  },
};

export function translateStep(step: BuildStep, design: FurnitureDesign, locale: string): BuildStep {
  if (locale !== "en") return step;

  // Dynamic per-joinery step: id matches /^step-05-\d+-(.+)$/, take last segment
  // as JoineryType to look up the description.
  const dynMatch = /^step-05-\d+-(.+)$/.exec(step.id);
  if (dynMatch) {
    const jType = dynMatch[1] as JoineryType;
    return {
      ...step,
      title: `Cut ${joineryLabel(jType, "en")} (${step.title.match(/\d+/)?.[0] ?? "?"} joints)`,
      description: JOINERY_STEP_DESC_EN[jType] ?? step.description,
    };
  }

  const override = STEP_OVERRIDE_EN[step.id];
  if (!override) return step;
  return {
    ...step,
    title: override.title(design),
    description: override.description(design),
  };
}

export function translateSteps(steps: BuildStep[], design: FurnitureDesign, locale: string): BuildStep[] {
  if (locale !== "en") return steps;
  return steps.map((s) => translateStep(s, design, locale));
}
