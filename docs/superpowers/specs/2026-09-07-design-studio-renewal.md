# Design Studio Renewal

Status: approved, implemented and locally verified on codex/design-studio-renewal; not deployed.

## Objective

Turn the existing furniture editor into an integrated design workspace, not a
marketing redesign. Preserve existing geometry, saved models, ownership checks,
entitlements, URLs and Chinese/English support. The previous integrated upgrade
is already released; this document describes a separate, unreleased project.

## Verified Existing Boundaries

- `app/[locale]/design/[type]/page.tsx` resolves permissions, saved snapshots,
  parameters, construction versions and exports on the server. Keep that authority.
- Desktop JSX and `components/mobile/MobileShell.tsx` currently implement separate
  layouts and forms. Do not add a third independent parameter implementation.
- `components/SelectedPartContext.tsx` already connects selection to material rows.
- `components/SaveDesignButton.tsx`, `components/design/DesignVersions.tsx`,
  history controls and draft recovery already implement persistence workflows.
- `components/MyDesignsClient.tsx` loads owned records, renames and deletes them.
- Quote and print routes already exist; their calculations must remain shared.

## Approach

Replace the presentation incrementally around the existing model resolver.
A shared client workspace receives server-rendered content slots and a bounded
model summary. It owns only view selection, panel visibility and selected-part UI,
not a second authoritative copy of furniture parameters.

Rejected alternatives: a cosmetic-only reskin does not solve navigation; a full
engine rewrite risks old designs and is unnecessary for the approved experience.

## Subproject A: Shared Workspace

Desktop at 1280px and above uses a flexible model viewport, a 280-320px parameter
panel and a 280px inspector. Both side panels collapse independently. At tablet
widths the inspector becomes a drawer. Under 768px parameters and inspection use
bottom sheets with bounded height, internal scrolling and safe-area spacing.
No horizontal page overflow is permitted at 360px width or with English labels.

The header contains the actual saved name when available, save status, undo/redo,
save, save-as, history, sharing and export actions. Overflow menus hold secondary
commands at narrow widths; they do not remove functions or change permissions.
Use existing Lucide icons where available, accessible names and hover tooltips.

Five workspace views: Design, Drawings, Materials, Build and Quote. Selecting a
view does not save, clear options, add a geometry undo entry, or lose pending
input. In-memory tab changes are the default; reload initially returns to Design.
Keep one active editable parameter form and one primary WebGL canvas. Resizing
must not produce two successful fields for the same parameter or reset edits.

The inspector shows selected part name, material, visible dimensions, cut
dimensions and existing joint information. No arbitrary part editing or drag-to-
resize is implied. Clearing selection produces a neutral overview; if a part
disappears after parameter changes, clear the stale selection safely.

Visual system: white surfaces, zinc text and toolbar, restrained emerald actions,
no decorative gradients or nested section cards. Model textures remain real
rendered assets. Cards are limited to repeated records and dialogs, radius <=8px.
Display type is fixed-size, letter spacing zero. Empty, loading, locked, offline
and failed states must remain readable and actionable.

## Subproject B: My Designs

Add name search, furniture-type filtering, updated/name sorting and grid/list
switching. Default to recently updated and offer continuation of the most recently
updated owned design. Opening always uses designId plus loadSaved=1, never a
reconstructed stale parameter URL. Preserve rename/delete permission checks.

Thumbnails must not misrepresent old saved geometry. Prefer a small captured
preview from an explicitly saved, verified current model, stored privately with
ownership enforcement. Do not backfill by rewriting customer records. Old designs
without a captured preview show a clearly identified furniture-type image, not
an alleged preview of their saved geometry. Thumbnail failure must never make a
successful design save appear failed. The implementation plan must verify the
existing schema and Storage policies before selecting the persistence adapter.

Do not create many WebGL canvases in the listing. Search and sorting must operate
on the complete fetched result; introduce paginated server queries if the current
API response limit prevents completeness. Show loading, no designs, no matches,
load failure with retry, and deletion/rename progress. Clear records on user change.

## Subproject C: Production Workflow Integration

Drawings contains existing three views, joint and part drawings; Materials uses
the existing selection-linked list; Build contains existing steps and tools.
Quote uses the same resolved design reference and current parameter set as the
workspace. Reuse existing quote calculations and client configuration components,
not a duplicate formula or an iframe. Keep standalone print/quote URLs functional.

Flush pending parameter input before navigating to a standalone output. Do not
print or export a different revision silently. Accurate machining continues to
use the protected raw model, including frozen snapshots; simplified assembly
geometry must not replace it. Locked actions retain server-side enforcement.

## Persistence Contract

Cloud saves stay explicit. Local draft recovery stays scoped to user/design and
does not overwrite cloud data without consent. Display unsaved, saving, saved,
failed and conflict states from the existing persistence controller rather than
guessing from URL changes. Save-as changes the active identity only on success.
History restoration retains its confirmation and optimistic revision check.
Changing work views must preserve dirty state and pending changes. No new cloud
autosave, collaboration, CAD freeform editing or automatic geometry migration.

## Acceptance And Release

Each subproject needs focused tests and independent review before integration.
Final browser acceptance covers 360, 390, 768, 1280 and 1440px widths in Chinese
and English, panel/tab keyboard navigation, modal focus return and no overlap.
Use screenshots and canvas pixel differences to prove loaded model assets and
rotation. Verify selection, parameter change, undo/redo, save/reopen, save-as,
draft recovery, conflict, history restore, revoked sharing and export downloads.
Simulate failed network requests; never delete or overwrite customer designs.

Run existing save/history, permission, export and legacy geometry regressions,
type checking, lint and production build. New layout is promoted only after these
pass. A layout rollback must preserve the same saved record schema and model.
Report local verification separately from deployment; do not claim release until
the deployed commit and production smoke checks have been confirmed.
