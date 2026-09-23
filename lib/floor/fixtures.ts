/**
 * 測試房間 fixtures — 給 calc.test.ts 與 UI 預設用。
 */
import type { FloorInput } from "./types";
import { DEFAULT_FLOOR_INPUT } from "./types";
import { getPreset } from "./presets";

export const FIXTURE_RECT: FloorInput = { ...DEFAULT_FLOOR_INPUT };

export const FIXTURE_L: FloorInput = {
  ...DEFAULT_FLOOR_INPUT,
  room: getPreset("l-shape"),
};

export const FIXTURE_T: FloorInput = {
  ...DEFAULT_FLOOR_INPUT,
  room: getPreset("t-shape"),
};
