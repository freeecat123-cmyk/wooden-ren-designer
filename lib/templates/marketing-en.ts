/**
 * English translations for /templates/[type] marketing copy.
 *
 * Phase 4 incremental rollout: only entries listed here unlock the /en/templates/[type]
 * route. zh-only categories (~17 of 20) keep returning notFound() on /en until translated.
 *
 * Coverage so far: stool, pencil-holder, side-table — the 3 templates that are free on
 * any plan, so /en visitors can preview without paywall friction.
 *
 * Add a new entry → /en/templates/{category} auto-unlocks via getTemplateMarketing.
 */
import type { FurnitureCategory } from "../types";
import type { TemplateMarketing } from "./marketing";

const M_EN = {
  stool: {
    category: "stool",
    seoTitle: "Square stool plans | Auto-generated 3-views, joinery, cut list — Wooden Ren Blueprint",
    seoDescription: "Build a four-leg stool from sizes to shop drawings in three seconds. Auto-laid mortise positions, three-view drawings, cut list. Free template. From Wooden Ren Carpenter Academy.",
    tagline: "Start your first mortise-and-tenon on a stool that's yours",
    subTagline: "Free template · build as many as you want · 30 min to grok joinery logic",
    whatItDoes: "A four-leg square stool is the classic woodworking starter — four legs, four aprons, one seat. Get those six things right and you've already nailed 80% of furniture joinery fundamentals.\n\nThis template takes length × width × height and lays out every mortise position, tenon depth (through for ≤25 mm legs, blind at 2/3 depth above), and how the X-axis and Z-axis aprons must stagger so they don't collide in the leg. You stop worrying \"are the legs too thin?\" \"will a thick apron split the leg?\" — the algorithm checks for you, and the output is ready for the shop.\n\nAfter one stool, every other piece of furniture starts to look like a scaled-up version of the same joinery: dining chairs, side tables, desks — same logic, bigger numbers.",
    keywords: ["square stool plans", "stool dimensions", "stool mortise and tenon", "DIY wooden stool", "woodworking starter project"],
    fitFor: {
      good: ["First-timers learning mortise-and-tenon", "Want to design furniture without learning CAD", "Looking for a small gift project to practice on"],
      notFor: ["Want to build large furniture (try dining-chair / dining-table)", "Pure design theorists who don't want to actually build"],
    },
    parameters: [
      { label: "L × W × H", desc: "Free plan capped at 35×35×45 cm; paid plans unlock any size" },
      { label: "Leg profile", desc: "Square or round — algorithm auto-fits mortise shape" },
      { label: "Apron height", desc: "Auto-scaled to seat width; flags when ratio is unsafe" },
      { label: "Splay angle", desc: "0° straight / 5–12° splayed, includes compound-angle math" },
    ],
    scenarios: [
      { tag: "Classroom", body: "Pull up the designer on every student's phone, each enters their own size — 30 minutes from abstract idea to drawings they can build." },
      { tag: "Weekend build", body: "Enter sizes Friday night, buy stock Saturday, build Sunday — one stool in three days." },
      { tag: "Gift build", body: "Measure the actual corner in a friend's home, build a one-off size that fits — far more meaningful than another IKEA piece." },
      { tag: "Father's Day", body: "Start two weeks before — a stool engraved with his initials beats anything off a department-store shelf." },
    ],
    faqs: [
      { q: "Why is the free plan capped at 35×35×45 cm?", a: "That's the natural \"stool\" envelope — anything larger becomes a low table and effectively a paid template. Upgrade to Personal to unlock any size." },
      { q: "Are thinner legs more elegant?", a: "Visually, yes. Structurally — too thin and once you cut a mortise there's barely any meat left to carry the load. The designer warns you when ratios go bad, but the final call is yours." },
      { q: "Can I build a round stool here?", a: "Round stools use a different leg algorithm (typically 3–4 splayed legs). Use the round-stool template instead." },
      { q: "How deep should the mortise be?", a: "Through tenon: depth = leg width. Blind tenon: 2/3 of apron thickness (e.g. 18 mm apron → 12 mm mortise). Too shallow pulls out; too deep blows out the back. The algorithm computes this from your apron thickness." },
      { q: "What tools do I need?", a: "Minimum: a saw (hand or table), 3 chisels (6/9/12 mm), a mallet, and either a hand drill or a mortiser. Power tools speed things up but hand tools work fine." },
    ],
    presets: [
      { name: "Straight-leg classic", desc: "Square straight legs — standard starter for learning mortises, easiest structure to reason about." },
      { name: "8° splayed", desc: "Legs leaning out 8° — visually lighter, compound geometry handled by the algorithm." },
      { name: "Tapered leg", desc: "Tapered toward the foot — common Nordic proportion, cuts apparent weight in half." },
      { name: "Wide-seat foot stool", desc: "Seat widened to 40 cm with a lower stretcher — works as a footstool or step." },
      { name: "Through-tenon decorative", desc: "Apron tenons run all the way through the leg, exposed end-grain on the outside — Ming-style traditional craft look." },
    ],
    howToSteps: [
      { name: "Mill and prep stock", text: "Cut leg, apron and seat stock to the cut-list sizes plus 5 mm of trim allowance per part. Square the end grain on the table saw." },
      { name: "Chop the apron mortises", text: "On each of the four legs, chop the apron mortises with a 9 or 12 mm chisel. Blind tenon depth = 2/3 of apron thickness (18 mm apron → 12 mm mortise). The two apron pairs need to stagger by 5 mm so corner tenons don't collide." },
      { name: "Cut the apron tenons", text: "Cut tenons on both ends of each apron. Mark shoulders carefully, table-saw the shoulders clean, then pare with a chisel until the tenon slides snug into the mortise without rocking." },
      { name: "Dry-fit and adjust", text: "Assemble four legs and four aprons dry. Check 90° at every corner with a try-square; diagonals equal. Pare any shoulder that's racking the frame." },
      { name: "Glue-up", text: "Disassemble, glue mortises and tenons evenly, reassemble in one pass with diagonal clamping. Re-check square after 30 minutes." },
      { name: "Sand and finish", text: "After glue cures: 120 → 180 → 240 grit with the grain. Two to three coats of Danish oil or water-based polyurethane, light sanding between coats." },
    ],
    related: ["round-stool", "bench", "side-table"],
  },
  "pencil-holder": {
    category: "pencil-holder",
    seoTitle: "Pencil holder plans | Square / hex / octagonal auto-modeling — Wooden Ren Blueprint",
    seoDescription: "Build a pencil holder in 10 minutes — the cheapest way to practice mitered and finger joints. Square, hex, octagonal, divided, brush holder — 6 presets, free to try.",
    tagline: "10 minutes to a pencil holder — the cheapest joinery practice there is",
    subTagline: "Free template · 6 presets (square / hex / octagonal / divided / brush holder / partitioned)",
    whatItDoes: "A pencil holder is the highest-ROI way to practice joinery — scrap stock under a dollar each, and you can drill on 30° / 45° / 60° miters, learn dado-housed dividers, edge-jointed panels and chamfered edges all on one piece.\n\nThis template supports 6 presets: simple square, divided desk grid, brush holder, tool tote, hexagonal tea caddy, octagonal cross-section. Each one auto-computes the miter angle, divider lengths, and the matching dado depth. Octagonal corners are 135° interior (which means a 22.5° saw-blade angle) — easy to get wrong by hand; the cut list just tells you \"set the table-saw blade to 22.5° and cut 8 pieces\".\n\nMake one for yourself, gift one to a friend, sell them at a craft market — pencil holders give the best learning per dollar of any woodworking project.",
    keywords: ["pencil holder plans", "wooden pencil holder", "hex box angle", "octagonal miter", "DIY desk organizer"],
    fitFor: {
      good: ["Practicing mitered joinery", "Using up scrap stock", "Selling at craft markets"],
      notFor: ["Looking to build large storage cabinets"],
    },
    parameters: [
      { label: "Shape", desc: "Square / hexagonal / octagonal / oval" },
      { label: "Size", desc: "Free plan capped at 20 × 20 × 25 cm" },
      { label: "Dividers", desc: "0–6 compartments — algorithm lays them out and computes dado depth" },
      { label: "Joinery", desc: "Mitered / finger / dovetailed — algorithm picks the most stock-efficient" },
    ],
    scenarios: [
      { tag: "Scrap-stock cleanup", body: "Got a pile of offcuts gathering dust? Ten pencil holders eats through it." },
      { tag: "Kids' project", body: "Design a pencil holder with your kid. 30 minutes from sketch to finished piece — they'll use it daily, more than any parenting blog can deliver." },
      { tag: "Craft market", body: "Made from shop scrap (cost under $1), sold at $8–15 each — viable weekend market stall margin." },
      { tag: "School project", body: "Hexagonal tea caddy is just hard enough to impress, just cheap enough to actually finish — perfect end-of-semester woodworking project." },
    ],
    presets: [
      { name: "Simple square", desc: "The simplest starter — four mitered boards." },
      { name: "Desk grid", desc: "4-compartment divider, salvation for desk OCD." },
      { name: "Brush holder", desc: "Tall body with shelf inserts — solid partner gift." },
      { name: "Tool tote", desc: "Holds planes and chisels point-up — bench-edge essential for any shop." },
      { name: "Hex tea caddy", desc: "Tea-people favorite — make it in cypress or pine and the aroma sticks around." },
      { name: "Octagonal cross", desc: "High-difficulty cross-section — finished piece photographs beautifully." },
    ],
    faqs: [
      { q: "What blade angle for a hex box?", a: "30° (each interior corner is 120°, so 180 − 120 = 60, and blade tilt is 60 / 2 = 30°). Octagonal is 22.5°. The cut list spells it out for each preset." },
      { q: "What wood works best?", a: "Use scrap. Cypress for aroma, oak for grain, pine for cheap — pencil holders aren't picky." },
      { q: "Can I build a bigger pencil holder?", a: "Free plan caps at 20 × 20 × 25 cm (anything bigger really becomes a vase or a storage tote). Upgrade to Personal for any size." },
      { q: "How do I glue mitered corners without slipping?", a: "Lay all 6 or 8 sides flat-edge-to-flat-edge on a strip of masking tape, glue, then fold up like a hinge — every corner closes simultaneously." },
      { q: "How deep should the divider dado be?", a: "Dado depth = 1/3 of divider thickness (9 mm divider → 3 mm dado). Too shallow rattles, too deep blows out the outside. The algorithm computes from your board thickness." },
    ],
    howToSteps: [
      { name: "Mill stock", text: "Pull scrap stock from the bin, leave 3 mm trim allowance, rip and crosscut to length, square the end grain." },
      { name: "Cut miters", text: "Set the table-saw blade to 45° for square, 30° for hex, 22.5° for octagonal. Miter both ends of every side. Dry-fit the corner — no gap = pass." },
      { name: "Cut divider dados", text: "If using dividers, dado the inside walls to 1/3 board thickness (9 mm board → 3 mm dado) with a router or hand saw. Dry-fit the divider — no wobble." },
      { name: "Glue with tape clamp", text: "Dry-fit all corners first. Lay flat-edge-to-flat-edge on a strip of masking tape, glue, fold up to close. Let cure 30 minutes before peeling tape." },
      { name: "Sand and finish", text: "Sand outside and rim at 180 → 240 grit. Apply one or two coats of beeswax or boiled linseed oil for a tactile, natural finish." },
    ],
    related: ["dovetail-box", "tray", "photo-frame"],
  },
  "side-table": {
    category: "side-table",
    seoTitle: "Side table plans | Sofa-side / nightstand auto 3-views — Wooden Ren Blueprint",
    seoDescription: "Build the side table that actually fits next to your sofa or bed — auto joinery, 3-view drawings, cut list. Drawer, shelf or plain top — 3 seconds to shop-ready plans.",
    tagline: "The right-sized little table next to the sofa or the bed",
    subTagline: "Drawer / shelf / plain-top variants",
    whatItDoes: "Side tables are the piece of furniture you can never buy in the right size — store-bought is either too tall, too wide, or visually mismatched with your sofa. Building one yourself is the only way to nail the exact armrest height of your couch, the exact gap beside your bed.\n\nThis template ships three variants: plain-top (fastest build), drawer (for remote / glasses storage) and lower-shelf (stacks books / magazines). The drawer slide position is auto-computed from drawer width — you just walk into the hardware store and ask for \"13-inch full-extension slides, one pair\". Legs come in straight, 5° splayed, or 10° splayed — splayed gives a lighter look but needs compound angles, which the algorithm handles and outputs as ready-to-cut true-length numbers.\n\nA hardwood (oak / walnut) side table runs $25–50 in materials — about twice the lumber quality of an IKEA LACK at the same overall cost, dimensioned exactly for your room. Once you've built one, you've unlocked all \"table-class joinery\" — coffee tables, dining tables, desks all scale from the same logic. Best of all: you remember which board came from which tree, every time you set a coffee mug down.",
    keywords: ["side table plans", "sofa side table", "nightstand plans", "small wood table", "side table dimensions"],
    fitFor: {
      good: ["Want to fit an exact spot in your living room", "Practicing \"table-class\" joinery as an intermediate builder", "Upgrading living-room atmosphere with DIY"],
      notFor: ["No saw and no workshop access", "Hoping to finish in three days as a beginner (splayed legs need compound-angle setup time)", "Strictly $10-or-under budget (you can't even buy the lumber for that)"],
    },
    parameters: [
      { label: "Size", desc: "Suggested 40–60 cm wide × 40–50 cm tall (handy mug-height from the sofa)" },
      { label: "Drawer", desc: "0–1 drawer; auto-computes slide location and hardware spec" },
      { label: "Lower shelf", desc: "Optional; great for stacking books" },
      { label: "Leg style", desc: "Straight / splayed / tapered — three options" },
    ],
    scenarios: [
      { tag: "New apartment", body: "Just moved in, and every off-the-shelf side table is 5 cm too tall or 3 cm too narrow. Measure once, build once, it fits." },
      { tag: "Wedding gift", body: "Build two identical side tables as a wedding present — far more presence than anything off a registry." },
      { tag: "Housewarming", body: "Hand-engrave the initials, gift it to friends moving into their first home — they'll use it daily and remember." },
      { tag: "Guest-house outfit", body: "4 matching nightstands needed for the guest house. Quoted at $110 each, build them yourself for $30 in materials with better quality." },
    ],
    faqs: [
      { q: "Are splayed legs always better looking?", a: "Visually, yes — they look lighter. But the compound-angle math makes them harder to cut clean. Build a straight-leg version first, then graduate to splayed on table #2." },
      { q: "How hard are drawers?", a: "Dovetailed drawers are an intermediate move, but the algorithm pre-lays the dovetails for you — you just saw to the lines. Less scary than it sounds." },
      { q: "How do I choose the height?", a: "Sit on the sofa you'll use it next to, hang your arm naturally — the height a coffee mug rests easily is the right height. Usually 45–55 cm. Every sofa is different; measure before you build." },
      { q: "What top thickness?", a: "18 mm is the minimum; spans under 40 cm hold up fine. 21 mm gives a heavier, more grounded look. Thicker reads more substantial." },
      { q: "Should the lower shelf be fixed or adjustable?", a: "Side tables usually have one shelf, and fixed is sturdier (screwed or joined). Adjustable shelves make sense in bookcases where you change book heights — overkill here." },
    ],
    presets: [
      { name: "Straight leg + plain top", desc: "Four straight legs and a top — the quickest build, low footprint next to the sofa." },
      { name: "Tapered leg + drawer", desc: "Tapered legs with a single drawer — remote / glasses storage, ideal bedside config." },
      { name: "Splayed leg + shelf", desc: "5° splayed legs with a lower magazine shelf — classic Scandinavian profile." },
      { name: "Cross-stretcher all-joinery", desc: "Adds a lower stretcher, fully mortise-and-tenon with no screws — showcase-grade craft." },
    ],
    howToSteps: [
      { name: "Mill and prep stock", text: "Cut leg / apron / top stock to size + 5 mm allowance. Table-saw to precise dimensions, square the ends with a sled or panel jig." },
      { name: "Cut joinery", text: "Mark mortise positions on the legs, chop to 2/3 apron thickness with a 12 mm chisel. Cut tenons on both apron ends, refine until they slide in snug without rocking." },
      { name: "Dry-fit", text: "Assemble all legs and aprons without glue. Try-square each corner; diagonals equal. Pare any shoulder that's racking the frame." },
      { name: "Glue-up", text: "Disassemble, glue mortise and tenon walls, reassemble in one continuous pass, diagonal clamps tight. Recheck diagonals after 30 minutes; release clamps after 24 hours." },
      { name: "Attach top, sand", text: "Mount the top from underneath with figure-8 fasteners, or seat it into a groove. Sand the whole piece 120 → 240 grit." },
      { name: "Finish", text: "Two coats of Danish oil, wipe surplus after 30 minutes per coat. Burnish lightly at 400 grit between the second and third coat for a silky feel." },
    ],
    related: ["tea-table", "low-table", "nightstand"],
  },
} satisfies Record<string, TemplateMarketing>;

export const TEMPLATE_MARKETING_EN: Record<string, TemplateMarketing> = M_EN;

export const FEATURED_TEMPLATE_CATEGORIES_EN = Object.keys(M_EN) as FurnitureCategory[];
