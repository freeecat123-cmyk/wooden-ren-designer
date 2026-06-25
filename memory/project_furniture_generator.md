# Furniture Generator Memory

## 2026-06-25

- Saved design UX decision: "Save design" updates the currently opened cloud design when the URL has `designId`; "Save as new" creates a separate design record. Repeatedly pressing save on the same design must not create duplicates.
- Opening a design from "My Designs" should preserve the full saved params, including nested template `options`, and include `designId` in the URL so later saves update the same row.
- Undo/redo phase 1 decision: add page-local parameter history only. "Undo" and "Redo" navigate URL parameter snapshots in the current tab/session; they do not create saved design records or database versions.
