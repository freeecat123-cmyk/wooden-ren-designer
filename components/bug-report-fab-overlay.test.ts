import { describe, expect, it } from "vitest";
import { fullscreenLayerAbove } from "./BugReportFab";

type Style = {
  position: string;
  display: string;
  visibility: string;
  pointerEvents: string;
};

const WIN_W = 1440;
const WIN_H = 900;

function node(style: Partial<Style>, size: [number, number], parent: unknown = null) {
  const cs: Style = {
    position: "static",
    display: "block",
    visibility: "visible",
    pointerEvents: "auto",
    ...style,
  };
  return {
    parentElement: parent,
    __cs: cs,
    getBoundingClientRect: () => ({ width: size[0], height: size[1] }),
  };
}

const win = {
  innerWidth: WIN_W,
  innerHeight: WIN_H,
  getComputedStyle: (el: unknown) => (el as { __cs: Style }).__cs,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const check = (el: unknown) => fullscreenLayerAbove(el as any, win as any);

describe("fullscreenLayerAbove", () => {
  it("抓到放大三視圖那層(fixed inset-0 鋪滿、吃點擊)", () => {
    const overlay = node({ position: "fixed" }, [WIN_W, WIN_H]);
    const svg = node({}, [1200, 800], overlay);
    expect(check(svg)).toBe(true);
  });

  it("平常的設計頁不讓位", () => {
    const main = node({}, [WIN_W, 4000]);
    const card = node({}, [600, 400], main);
    expect(check(card)).toBe(false);
  });

  it("關著的 <dialog>(display:none)不算浮層", () => {
    // 分享對話框關著也留在 DOM 裡 —— 2026-10-25 的探針就是被它騙到
    const dlg = node({ position: "fixed", display: "none" }, [WIN_W, WIN_H]);
    expect(check(node({}, [10, 10], dlg))).toBe(false);
  });

  it("visibility:hidden 不算浮層", () => {
    const hidden = node({ position: "fixed", visibility: "hidden" }, [WIN_W, WIN_H]);
    expect(check(node({}, [10, 10], hidden))).toBe(false);
  });

  it("TrialWatermark 這種 pointer-events:none 的常駐層不算浮層", () => {
    // 誤判的話試用版使用者永遠看不到「回報問題」鈕
    const mark = node({ position: "fixed", pointerEvents: "none" }, [WIN_W, WIN_H]);
    expect(check(node({}, [10, 10], mark))).toBe(false);
  });

  it("沒鋪滿畫面的 fixed(sticky header / 側欄)不算浮層", () => {
    const header = node({ position: "fixed" }, [WIN_W, 64]);
    expect(check(node({}, [100, 40], header))).toBe(false);
    const rail = node({ position: "fixed" }, [320, WIN_H]);
    expect(check(node({}, [100, 40], rail))).toBe(false);
  });

  it("89% 高不算、90% 高才算(邊界手算:900*0.9=810)", () => {
    expect(check(node({ position: "fixed" }, [WIN_W, 809]))).toBe(false);
    expect(check(node({ position: "fixed" }, [WIN_W, 810]))).toBe(true);
  });

  it("elementFromPoint 回 null 時不讓位", () => {
    expect(check(null)).toBe(false);
  });
});
