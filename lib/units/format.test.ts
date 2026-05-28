import { describe, expect, it } from "vitest";
import {
  formatInchFraction,
  formatLength,
  formatLengthBare,
  mmToInches,
  MM_PER_INCH,
} from "./format";

describe("mmToInches", () => {
  it("converts using 25.4", () => {
    expect(mmToInches(MM_PER_INCH)).toBeCloseTo(1, 10);
    expect(mmToInches(50.8)).toBeCloseTo(2, 10);
  });
});

describe("formatInchFraction", () => {
  it("formats a whole inch without fraction", () => {
    expect(formatInchFraction(25.4)).toBe('1"');
    expect(formatInchFraction(50.8)).toBe('2"');
  });

  it("formats half inch reduced from 8/16", () => {
    expect(formatInchFraction(12.7)).toBe('1/2"');
  });

  it("formats mixed 1-1/2 with dash separator", () => {
    expect(formatInchFraction(38.1)).toBe('1-1/2"');
    // 38mm rounds to 1-1/2" at 1/16 precision (37.69 actual, off by 0.4mm)
    expect(formatInchFraction(38)).toBe('1-1/2"');
  });

  it("formats 3/4 reduced from 12/16", () => {
    expect(formatInchFraction(19.05)).toBe('3/4"');
    expect(formatInchFraction(19)).toBe('3/4"');
  });

  it("formats 9/16 (already in lowest terms)", () => {
    // 9/16" = 14.2875mm
    expect(formatInchFraction(14.2875)).toBe('9/16"');
    expect(formatInchFraction(14)).toBe('9/16"');
  });

  it("rounds sub-1/16 values to nearest 1/16", () => {
    // 1mm ≈ 0.039", 1/16 = 0.0625" → rounds to 1/16
    expect(formatInchFraction(1)).toBe('1/16"');
    // 0.5mm ≈ 0.0197", rounds to 0
    expect(formatInchFraction(0.5)).toBe('0"');
  });

  it("rounds up to next whole inch at the edge", () => {
    // 25.3mm = ~0.9961" → 16/16 → 1"
    expect(formatInchFraction(25.3)).toBe('1"');
  });

  it("handles 0", () => {
    expect(formatInchFraction(0)).toBe('0"');
  });

  it("preserves negative sign", () => {
    expect(formatInchFraction(-12.7)).toBe('-1/2"');
    expect(formatInchFraction(-25.4)).toBe('-1"');
  });

  it("supports custom denominator (1/8)", () => {
    // 19mm = 3/4" = 6/8
    expect(formatInchFraction(19.05, 8)).toBe('3/4"');
    // 22.225mm = 7/8"
    expect(formatInchFraction(22.225, 8)).toBe('7/8"');
  });

  it("returns em-dash for NaN/Infinity", () => {
    expect(formatInchFraction(NaN)).toBe("—");
    expect(formatInchFraction(Infinity)).toBe("—");
  });
});

describe("formatLength", () => {
  it("dispatches to mm formatting", () => {
    expect(formatLength(38, "mm")).toBe("38 mm");
    expect(formatLength(38.5, "mm")).toBe("38.5 mm");
  });

  it("dispatches to fraction formatting", () => {
    expect(formatLength(38, "inch")).toBe('1-1/2"');
  });
});

describe("formatLengthBare", () => {
  it("drops inch mark for bare output", () => {
    expect(formatLengthBare(38, "inch")).toBe("1-1/2");
    expect(formatLengthBare(25.4, "inch")).toBe("1");
  });

  it("drops unit for mm", () => {
    expect(formatLengthBare(38, "mm")).toBe("38");
    expect(formatLengthBare(38.5, "mm")).toBe("38.5");
  });
});
