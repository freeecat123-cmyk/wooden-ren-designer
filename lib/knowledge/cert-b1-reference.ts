/** Verified dimensions only. This is deliberately not a catalog template. */
export const CERT_B1_REFERENCE = {
  question: "01200-100201",
  status: "dimension-reference",
  source: {
    url: "https://owinform.wdasec.gov.tw/owInform/DLowFile/012002B15.pdf",
    revision: "114/06/18",
    sha256: "2cc5f1cce36f9468dd3d4c8be93d442e5b8f55e44d4e4dde780e8bb2f44d951f",
  },
  dimensions: {
    height: { value: 450, tolerance: 1, scoringPdfPage: 7, drawingPdfPage: 15 },
    frameWidth: { value: 410, tolerance: 1, scoringPdfPage: 7, drawingPdfPage: 15 },
    frameDepth: { value: 410, tolerance: 1, scoringPdfPage: 7, drawingPdfPage: 15 },
    topLength: { value: 450, tolerance: 1, scoringPdfPage: 7, drawingPdfPage: 15 },
    topWidth: { value: 450, tolerance: 1, scoringPdfPage: 7, drawingPdfPage: 15 },
    drawerWidth: { value: 340, tolerance: 1, scoringPdfPage: 7, drawingPdfPage: 15 },
    drawerDepth: { value: 350, tolerance: 1, scoringPdfPage: 7, drawingPdfPage: 15 },
    sideAndBackRailHeight: { value: 105, tolerance: 0.5, scoringPdfPage: 7, drawingPdfPage: 15 },
    legWidth: { value: 45, tolerance: 0.5, scoringPdfPage: 7, drawingPdfPage: 15 },
    legThickness: { value: 32, tolerance: 0.5, scoringPdfPage: 7, drawingPdfPage: 15 },
    drawerFrontHeight: { value: 103, tolerance: 0.5, scoringPdfPage: 7, drawingPdfPage: 15 },
  },
  unresolved: [
    "Map every joint in sections A-A, B-B and C-C to paired local coordinates.",
    "Resolve drawer dovetail counts, geometry, bottom grooves and running clearance.",
    "Separate the top core, solid edging and attachment dowels in the cut list.",
    "Verify the curved front rail, finger hole and specified chamfers in all exports.",
    "Reconcile used dowels and screws with supplied stock without inventing hole positions.",
  ],
} as const;

/** The scoring frame width is not the maximum outside furniture width. */
export function certB1Envelope() {
  const d = CERT_B1_REFERENCE.dimensions;
  return { length: d.topLength.value, width: d.topWidth.value, height: d.height.value };
}
