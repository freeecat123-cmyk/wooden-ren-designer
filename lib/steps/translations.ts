/**
 * Build-step EN translations.
 *
 * deriveBuildSteps() runs in zh-TW and bakes in dynamic values via template
 * literals — we can't pre-translate the final strings. Instead, this file
 * provides parallel EN renderers that re-build each step from raw design
 * data, then translateStep() swaps title + description + bullets + warnings
 * on /en.
 *
 * Coverage: 27 static steps + 13 joinery-type bullet sets.
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
  bullets?: (design: FurnitureDesign) => string[];
  warnings?: (design: FurnitureDesign) => string[];
}

const JOINERY_STEP_BULLETS_EN: Record<JoineryType, string[]> = {
  "through-tenon": [
    "Mark and chop the mortise from both faces — chop halfway from each side and meet in the middle, otherwise the back face blows out.",
    "Ease the tenon end with a 0.2 mm chamfer so it guides into the mortise; tap home with a mallet.",
    "The 1–2 mm of tenon sticking through can stay as a design feature or be flushed off and sanded.",
  ],
  "blind-tenon": [
    "Mortise depth ≤ 2/3 of mother thickness — go deeper and you punch through.",
    "Tape a depth stop on the chisel before chopping so you don't overshoot.",
    "Tenon should be 1 mm shorter than the mortise to leave a glue space — bottoming out starves the joint.",
  ],
  "shouldered-tenon": [
    "Fixed 6 mm haunch shoulder on each side — narrower is weak, wider is wasteful and ugly.",
    "Saw shoulders 0.5 mm deeper than the tenon face so the shoulder seats tight against the mother.",
    "Tenon thickness = min(apron − 12 mm, leg / 3) — too thick and the mother splits.",
  ],
  "stub-joint": [
    "Cut the pocket on the mother to the exact full cross-section of the male part — fit should be snug but not requiring a mallet.",
    "Mark from a reference face on both pieces so the housing aligns with the mating part's shoulder.",
    "Pocket depth = mother thickness × 2/3 unless it's a through housing; deeper is rarely useful and weakens the mother.",
  ],
  "half-lap": [
    "Each piece is rebated to exactly half its thickness — calibrate the cut on a scrap first.",
    "Saw shoulder square to the face; pare with a chisel to the depth line.",
    "Strength on a vertical half-lap = ~50% of the parent stock; on a horizontal cross-lap it's only ~12%.",
  ],
  dovetail: [
    "Traditional sequence: tails first, then transfer to the pin board (most accurate fit).",
    "Saw tails on the waste side leaving a 0.3 mm line — pare to the line with a sharp chisel.",
    "Dovetail angle: 1:8 (≈7°) for hardwood, 1:6 (≈9.5°) for softwood. Too shallow = weak pull-out, too steep = short grain breaks.",
  ],
  "finger-joint": [
    "Mark fingers on one wall first, transfer pattern to the mating wall from the cut wall.",
    "Saw on the waste side 0.3 mm shy — pare to the line. Overshoot opens gaps that won't close in glue-up.",
    "Adjacent walls must have opposite finger / groove phase — fingers on one face meet grooves on the next.",
    "Dry-fit before glue: too tight = pare a hair, too loose = a paper shim and re-glue.",
  ],
  "tongue-and-groove": [
    "Tongue thickness = 1/3 of board thickness — thicker splits the grooved board.",
    "Groove depth = tongue length + 1 mm to leave a glue space.",
    "Leave 1 mm shoulder on each side of the tongue for grain reinforcement.",
  ],
  dowel: [
    "Use a self-centering doweling jig — eyeballed holes never line up.",
    "8 mm fluted dowels at ~150 mm spacing on a panel edge are standard.",
    "Drill holes 1 mm deeper than half-dowel-length on each side to leave a glue reservoir.",
  ],
  "mitered-spline": [
    "Cut both 45° miters first and dry-fit — a sloppy miter cannot be saved by a spline.",
    "Spline groove = 1/3 of stock thickness, centered. Spline grain runs across the miter line.",
  ],
  mitered: [
    "Glue-only miters fail under any pull-out load — picture frames and decorative trim only.",
    "Squeeze the miter under a band clamp or strap clamp; clamp pressure on a miter from one side opens the joint on the other.",
  ],
  "pocket-hole": [
    "Drill the pocket holes on the *male* (apron / stretcher / drawer-side) part, not the mother.",
    "Vacuum the hole clean before driving the screw — chips block depth and starve the threads.",
    "Drive the screw within 10 minutes of glue-up: glue is wet, screw clamps it tight, then glue cures.",
  ],
  screw: [
    "Pre-drill a pilot hole 0.5 mm under the screw shank diameter to avoid splitting.",
    "Counterbore + plug for hidden joinery; countersink + filler for utility.",
  ],
};

const STEP_OVERRIDE_EN: Record<string, OverrideEntry> = {
  "step-01-select-stock": {
    title: () => "Select and inspect stock",
    description: (design) => {
      const mat = materialName(design.primaryMaterial, "en");
      return `Working in ${mat}. Pick boards with clean, straight grain, no major knots, and stress-released stock (no edge bow). Leave 5–10% trim waste — don't skimp on this buffer for larger projects.`;
    },
    bullets: () => [
      "Moisture content must be ≤12% (8–10% ideal in dry climates). High-MC stock will shrink after glue-up and split tenons.",
      "Save the cleanest grain / colour for visible faces (top, seats, doors).",
      "Avoid knots > 10 mm on load-bearing structural parts.",
      "Hardwoods (oak / beech): sharpen tools before working — dull edges chip the stock and risk injury. Softwoods (pine / fir): raise plane angle and slow the cut to avoid tear-out.",
    ],
  },
  "step-02-jointer-planer": {
    title: () => "Joint and thickness-plane",
    description: () =>
      "Joint one reference face plus one 90° edge (square to the face), then thickness-plane the opposite face parallel to the reference. No jointer / planer? Buy pre-milled (S4S) stock and skip ahead.",
    bullets: () => [
      "Joint the reference face first; check with a try-square that the second face is 90° to it before moving on.",
      "Planer passes ≤ 1.5 mm (≤ 1 mm in hardwood) — multiple light passes leave less tear-out than one heavy one.",
      "Leave 0.5 mm for sanding — don't plane to final thickness; sanding will remove another 0.3–0.5 mm.",
    ],
  },
  "step-03-cut-stock": {
    title: (design) => `Cut to length — ${design.parts.length} parts`,
    description: () =>
      "Cut milled stock into individual parts per the cut list. **Note:** parts with tenons already include the tenon stock — don't add length. Mark each part on the side with its part-id (e.g., leg-l-f / apron-front) right after cutting so dry-fit doesn't turn into a guessing game.",
    bullets: () => [
      "**Cut longest parts first** — long stock can become short, but short stock can't grow back.",
      "Mark the cut line with a try-square + pencil or marking knife, and keep the saw kerf on the waste side.",
      "Check both ends square after each cut — a plane can fix a slightly out-of-square end now, but not after glue-up.",
      "The cut list shows two numbers per part: \"visible size\" and \"cut size\". Joinery parts will differ by the tenon length — cut to the **cut size**.",
    ],
    warnings: () => ["Double-check the cut list before every saw cut — you can't un-cut a board."],
  },
  "step-03b-glue-up-top": {
    title: (design) => `Edge-glue panel — ${design.overall.length} mm top`,
    description: (design) =>
      `A ${design.overall.length} mm diameter top typically needs 3–5 boards (each 150–200 mm wide) edge-glued. Alternate the growth-ring orientation up/down to resist cupping; reinforce the joint line with biscuits or splines; clamp with parallel clamps for 8+ hours before releasing.`,
    bullets: () => [
      "Joint the mating edges to a perfect 90° before glue-up. A visible gap on dry-fit will still be there after clamping.",
      "Arrange boards with growth rings alternating ↑↓↑↓ to resist cupping.",
      "Glue from the center outward when clamping to avoid bowing the panel.",
      "After 8 hours cure → release clamps → flatten both faces with a thickness sander or drum sander before cutting the circle.",
    ],
    warnings: () => ["Use PVA (yellow) wood glue. Epoxy or CA glue will become brittle and fail."],
  },
  "step-03c-cut-circle": {
    title: (design) => `Cut the round top (⌀${design.overall.length} mm)`,
    description: () =>
      "After the glue-up cures, mark center, rough-cut 5 mm proud with a jigsaw, then finish with a router + circle jig (bearing-guided straight bit, ≤3 mm per pass).",
    bullets: () => [
      "Rough-cut 5 mm shy of the line with a jigsaw — don't try to cut to final size in one go.",
      "Router + circle jig with a straight bit, pivot around the center pin, ≤ 3 mm depth per pass.",
      "Ease the edge with an R5–R10 roundover bit afterwards — a sharp edge will cut hands and chip in use.",
    ],
  },
  "step-03d-bent-panels": {
    title: () => "Make bent panels (curved lamination / steam / kerf)",
    description: () =>
      "Three approaches: (A) **Lamination** — saw the panel into 4–6 layers ~5 mm thick, glue with PVA on a form, clamp 8 hours; least springback, most reliable. (B) **Steam bending** — 1 hour per 25 mm of stock in a steam box, then clamp on a form to cool; needs a steam rig. (C) **Kerf bending** — saw N kerfs in the back leaving ~3 mm web, force the curve and glue; simplest but weakest and the kerfs show.",
    bullets: () => [
      "**Make the bending form first**: two MDF cauls cut to matching concave / convex curves, ~100 mm longer than the panel for clamping wings (works for lamination and steam).",
      "Thinner laminations bend more easily and rebound less — 3 mm strips beat 6 mm.",
      "Steam-bending success rate is highest in hardwood (oak / beech); softwoods (pine / fir) often crack.",
      "Cut joinery **after** bending, not before — the bent geometry shifts the mortise positions.",
    ],
    warnings: () => [
      "Let the bent piece rest 24–48 h to equalize moisture before further work; chiseling immediately afterwards causes joint creep.",
      "Stock usage: arc length × ~1.02 (2% loss) for steam bending; lamination adds ~10% for thin-resawn waste.",
    ],
  },
  "step-04-mark": {
    title: () => "Lay out the joinery (tenons + mortises)",
    description: () =>
      "Mark every tenon and mortise from the joinery detail drawings. Check every layout against the three-view drawings before any saw or chisel touches the wood.",
    bullets: () => [
      "**Mark from a reference face**: pick one face per part as the datum and measure every layout from it. Stops 0.5 mm errors from compounding.",
      "Use a marking gauge or marking knife — pencil lines are 0.3 mm wide, and the saw will cut wherever the pencil is widest.",
      "Cut a shallow V with a marking knife on shoulder / saw lines; the saw teeth fall into the V and won't drift.",
      "Lay out all joints of the same kind in one session (e.g., all 8 tenons on the 4 aprons) — avoids tool / gauge changeovers.",
    ],
    warnings: () => ["Layout errors can be erased now; saw cuts can only be patched with shavings and glue."],
  },
  "step-05-assembly-prep": {
    title: () => "Mechanical-joinery prep (pocket hole / dowel / DOMINO — pick one)",
    description: () =>
      "Assembly mode replaces traditional joinery with mechanical fasteners. **Pick one method and stick with it** — mixing makes alignment harder. (A) **Pocket holes** (fastest, beginner-friendly): drill 15° holes on the male part (aprons / stretchers / drawer sides) with a jig and drive #6 × 1¼\" screws. (B) **Dowels** (cheapest): drill ⌀8 × 30 mm holes on both parts with a doweling jig, insert 8 × 40 mm dowels + glue. (C) **DOMINO** (most pro, needs a Festool): cut slots with the joiner, insert 5 × 30 mm DOMINOs.",
    bullets: () => [
      "**One method per build** — pocket-hole aprons + dowel drawers makes alignment headaches.",
      "Drill pocket holes on the male part (apron / stretcher); mother (leg) stays clean. **Hidden face up** so screw heads never face the room.",
      "Vacuum every hole clean before driving — chips block depth and starve the threads.",
      "Drive the screw within 10 minutes of glue-up: glue is wet, screw clamps tight, then the glue cures.",
    ],
    warnings: () => [
      "**Never point pocket holes at the room** — the visible face of an apron must face the wall or floor.",
      "Dowels must be a snug fit (finger-push in, mallet-tap home). Loose dowels = no joint.",
    ],
  },
  "step-05-corner-finger-joint": {
    title: () => "Cut finger joints (4 corners)",
    description: () =>
      "Make the fingers on one wall first, mark the mating wall from it. Alternate finger / groove phase on adjacent walls so they interlock.",
    bullets: () => [
      "Use a marking gauge / marking knife to lay out the comb on both ends from the reference face — avoids accumulated error.",
      "Saw on the waste side 0.3 mm shy, pare to the line with a sharp chisel — over-cut opens gaps that won't close in glue-up.",
      "Adjacent walls have opposite finger / groove phase (one wall starts with a finger, its neighbor starts with a groove).",
      "Dry-fit before glue: tight = pare a hair, loose = shim with paper.",
    ],
    warnings: () => ["Clamp the workpiece flat and square while sawing — a 0.5 mm drift across the full comb ruins it."],
  },
  "step-05-corner-dovetail": {
    title: () => "Cut dovetails (4 corners)",
    description: () =>
      "Make the tails first, transfer the pin layout from the tails, then cut the pins. Hardwood dovetails: 7–9°; softwood: 10–14°. End pieces should be half-pins so corners don't break out.",
    bullets: () => [
      "Use a dovetail marker (or sliding bevel set to your chosen angle) to mark the tails — wider at the outside, narrower inside.",
      "Saw the tails on the waste side 0.3 mm shy of the line, stop at the shoulder.",
      "**Transfer the pin layout from the cut tails** (mark on the pin board with a pencil/knife held against the tails) — most accurate fit.",
      "Saw the pins on the opposite-bevel angle (pins narrow outside, wide inside — interlocking).",
      "Chop the waste between pins from both faces — half-way each side so the back face doesn't blow out.",
      "Dry-fit: tight = pare the shoulder a hair; loose = a shaving + glue powder fills the gap.",
    ],
    warnings: () => [
      "Dovetail angle ≤ 14° — steeper than that the short grain on the tail tip will break out.",
      "Hardwood (oak / beech): 7–8°. Softwood (pine / fir): 10–12°.",
    ],
  },
  "step-06-dry-fit": {
    title: () => "Dry-fit (no glue)",
    description: () =>
      "Assemble every joint without glue first. Target fit: pushes in by hand, seats with a light mallet tap, takes some effort to pull out. **Pare tenons, never mortises** — mortises are mother structure, you ruin them and the part is scrap.",
    bullets: () => [
      "Dry-fit in the same sequence you'll use for glue-up — sub-assemblies first (leg frames, drawer boxes), then combine.",
      "Check 90° at every corner with a try-square; if it's off, you can still adjust.",
      "Measure both diagonals across the carcase — equal = square, unequal = racked.",
      "Tight tenons: **pare lightly**, 0.2 mm at a time, testing between cuts. Aggressive paring leaves a loose joint.",
    ],
    warnings: () => [
      "Don't force-tight tenons home with a mallet — glue makes wood expand and the mother will split.",
    ],
  },
  "step-07a-glue-frame": {
    title: () => "Glue up the leg frames (sides first)",
    description: () =>
      "Never glue all four legs at once. Build the left side frame (left front leg + left back leg + left apron), then the right side, let them cure 24 hours, then connect with the front and back aprons. Stage-glue so you're not aligning four tenons in 10 minutes of open time.",
    bullets: () => [
      "Clamp each side frame perfectly square (try-square + diagonal check).",
      "Pad clamp jaws with scrap (5 mm sacrificial blocks) to avoid clamp dents on the finished face.",
      "Wait 24 hours after sub-assembly glue-up before combining — PVA reaches full strength in 24 h.",
    ],
    warnings: () => ["Once glue starts to set (~10 min), don't readjust — the bond will be broken and the joint will be at half strength."],
  },
  "step-07b-glue-drawer-box": {
    title: () => "Glue up the drawer boxes",
    description: () =>
      "Each drawer assembled independently. Sequence: glue front + 2 sides (dovetail or half-lap), check for square, attach the back, slide the bottom in from the back — **do not glue the bottom**, it needs to move with seasonal humidity.",
    bullets: () => [
      "Drawer box must be perfectly square — out-of-square boxes will bind in the cabinet.",
      "Leave a 1 mm glue gap around the bottom so the panel can expand / contract without splitting the sides.",
      "Attach the drawer-front to the box with screws from inside (not glue) — lets you fine-tune front alignment later.",
    ],
  },
  "step-07c-glue-door": {
    title: () => "Build the doors (frame-and-panel or flat)",
    description: () =>
      "Frame-and-panel: rails + stiles around a floating panel. **Don't glue the panel into the frame** — it must move; leave 2 mm expansion gap. Flat-plywood door: cut to size, edge-band all four sides.",
    bullets: () => [
      "The floating panel **must never be glued** to the frame — wood movement will split the frame.",
      "Wax or pre-finish all four edges of the panel before assembly — keeps the visible edge from showing unfinished wood when it shrinks in winter.",
      "After glue-up, measure diagonals — square it with a clamp twist if needed and let it cure 24 h.",
    ],
  },
  "step-08-glue-final": {
    title: () => "Final glue-up (combine sub-assemblies)",
    description: () =>
      "Combine the cured sub-assemblies (frames / drawer boxes / doors) with the main structure (top / sides / back). Thin PVA on tenon walls and inside mortises — 1 mm coat is plenty; thicker just squeezes out and is hard to clean up.",
    bullets: () => [
      "**Lay out all clamps before opening the glue bottle** — PVA open time is 8–10 minutes, no time to hunt for clamps.",
      "Wipe glue squeeze-out with a damp rag immediately — dried glue blocks stain and finish.",
      "Measure diagonals right after clamping — if racked, release one clamp and re-clamp to pull it square before the glue sets.",
      "24-hour cure for full strength before releasing clamps and sanding. 6 hours gets you to handle-able but only half-strength.",
    ],
    warnings: () => [
      "Glue-and-clamp the entire assembly in one continuous pass (within 10 minutes). Don't pause.",
      "Pad clamp jaws — bare metal will dent the finished face permanently.",
    ],
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
    bullets: () => [
      "Hardwoods (oak / beech) with deep plane marks: start at 100 grit. Softwoods (pine / fir): 120 grit is fine.",
      "Use a random-orbit sander for efficiency; corners and edges by hand to avoid rounding them over.",
      "Ease sharp edges with a 1 mm chamfer — sharp arrises cut hands and lose finish first.",
    ],
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
    warnings: () => [
      "**Oil-soaked rags can spontaneously combust!** Lay them flat to dry or submerge in water before disposal — never ball them up. The exothermic oxidation will start a fire.",
    ],
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
    bullets: () => [
      "Standard Euro-hinge placement: 100 mm in from the top and bottom of the door; add a third in the middle if the door is > 1 m tall.",
      "Even 3 mm reveals all around — adjust at the three hinge screws to dial it in.",
    ],
  },
  "step-19-drawer-slide": {
    title: () => "Install drawer slides (if used)",
    description: () =>
      "Full-extension slides: outer rail to cabinet side, inner rail to drawer side. The two rails must be perfectly horizontal and aligned left/right or the drawer will bind. Traditional wood runners also work.",
    bullets: () => [
      "Outer-rail front face flush with the cabinet front edge — drawer fronts will cover the slides.",
      "Left/right rail height tolerance ≤ 1 mm. > 3 mm and the drawer will bind.",
    ],
  },
  "step-99-final-check": {
    title: () => "Final inspection and sign-off",
    description: () =>
      "Once all glue and oil are fully cured (~72 hours total), do a final check.",
    bullets: (design) => {
      const hasDoor = design.parts.some((p) => /door|panel/.test(p.id));
      const hasDrawer = design.parts.some((p) => /(?:^|-)drawer/.test(p.id) && /front|side|back|bottom/.test(p.id));
      return [
        "**Square**: try-square on all four corners; diagonals equal.",
        "**Level**: spirit level on the top / seat — should sit flat in any direction.",
        "**Stability**: rock the piece — every foot should sit flat. If one leg lifts, plane the longest one down with a card scraper.",
        ...(hasDoor ? ["Door reveals even at 3 mm, opens and closes smoothly."] : []),
        ...(hasDrawer ? ["Drawer slides smoothly, no binding, no tilt."] : []),
        "Finish feels silky-smooth, no grit or missed spots.",
      ];
    },
  },
};

export function translateStep(step: BuildStep, design: FurnitureDesign, locale: string): BuildStep {
  if (locale !== "en") return step;

  // Dynamic per-joinery step: id matches /^step-05-\d+-(.+)$/, take last segment
  // as JoineryType to look up the description / bullets.
  const dynMatch = /^step-05-\d+-(.+)$/.exec(step.id);
  if (dynMatch) {
    const jType = dynMatch[1] as JoineryType;
    return {
      ...step,
      title: `Cut ${joineryLabel(jType, "en")} (${step.title.match(/\d+/)?.[0] ?? "?"} joints)`,
      description: JOINERY_STEP_DESC_EN[jType] ?? step.description,
      bullets: JOINERY_STEP_BULLETS_EN[jType] ?? step.bullets,
    };
  }

  const override = STEP_OVERRIDE_EN[step.id];
  if (!override) return step;
  return {
    ...step,
    title: override.title(design),
    description: override.description(design),
    bullets: override.bullets ? override.bullets(design) : step.bullets,
    warnings: override.warnings ? override.warnings(design) : step.warnings,
  };
}

export function translateSteps(steps: BuildStep[], design: FurnitureDesign, locale: string): BuildStep[] {
  if (locale !== "en") return steps;
  return steps.map((s) => translateStep(s, design, locale));
}
