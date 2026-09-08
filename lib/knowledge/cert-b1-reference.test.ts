import { expect, it } from "vitest";
import { CERT_B1_REFERENCE, certB1Envelope } from "./cert-b1-reference";

it("distinguishes the workpiece envelope from the scoring frame dimensions", () => {
  expect(certB1Envelope()).toEqual({ length: 450, width: 450, height: 450 });
  expect(CERT_B1_REFERENCE.dimensions.frameWidth.value).toBe(410);
  expect(CERT_B1_REFERENCE.dimensions.frameDepth.value).toBe(410);
  expect(CERT_B1_REFERENCE.dimensions.topLength.value).toBe(450);
});

it("retains measurement evidence, tolerances and drawing page numbers", () => {
  for (const dimension of Object.values(CERT_B1_REFERENCE.dimensions)) {
    expect(dimension.value).toBeGreaterThan(0);
    expect(dimension.tolerance).toBeGreaterThan(0);
    expect(dimension.scoringPdfPage).toBe(7);
    expect(dimension.drawingPdfPage).toBe(15);
  }
  expect(CERT_B1_REFERENCE.dimensions.legWidth.value).toBe(45);
  expect(CERT_B1_REFERENCE.dimensions.legThickness.value).toBe(32);
  expect(CERT_B1_REFERENCE.dimensions.drawerWidth.value).toBe(340);
  expect(CERT_B1_REFERENCE.dimensions.drawerDepth.value).toBe(350);
});

it("does not mark a dimensional reference as a finished exam model", () => {
  expect(CERT_B1_REFERENCE.status).toBe("dimension-reference");
  expect(CERT_B1_REFERENCE.unresolved.length).toBeGreaterThan(0);
  expect(CERT_B1_REFERENCE.source.sha256).toBe("2cc5f1cce36f9468dd3d4c8be93d442e5b8f55e44d4e4dde780e8bb2f44d951f");
});
