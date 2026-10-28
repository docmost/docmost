import { describe, expect, it } from "vitest";
import { isPreviewInView } from "./preview-visibility";

type Entry = Parameters<typeof isPreviewInView>[0];

const rect = (height: number) => ({ height }) as DOMRectReadOnly;

const entry = (init: {
  ratio: number;
  rectHeight: number;
  rootHeight: number | null;
}): Entry => ({
  isIntersecting: true,
  intersectionRatio: init.ratio,
  intersectionRect: rect(init.rectHeight),
  rootBounds: init.rootHeight === null ? null : rect(init.rootHeight),
});

describe("isPreviewInView", () => {
  it("is false when the embed is off screen", () => {
    const fullyVisible = entry({ ratio: 1, rectHeight: 600, rootHeight: 800 });

    expect(isPreviewInView({ ...fullyVisible, isIntersecting: false })).toBe(
      false,
    );
  });

  it("is false for a short embed only partly on screen", () => {
    expect(
      isPreviewInView(entry({ ratio: 0.3, rectHeight: 180, rootHeight: 800 })),
    ).toBe(false);
  });

  it("is true once a short embed is fully on screen", () => {
    expect(
      isPreviewInView(entry({ ratio: 1, rectHeight: 600, rootHeight: 800 })),
    ).toBe(true);
  });

  it("is true when a tall embed fills the screen", () => {
    expect(
      isPreviewInView(entry({ ratio: 0.5, rectHeight: 760, rootHeight: 800 })),
    ).toBe(true);
  });

  it("is false for a tall embed that only covers part of the screen", () => {
    expect(
      isPreviewInView(entry({ ratio: 0.4, rectHeight: 480, rootHeight: 800 })),
    ).toBe(false);
  });

  it("falls back to the ratio without root bounds", () => {
    expect(
      isPreviewInView(entry({ ratio: 1, rectHeight: 600, rootHeight: null })),
    ).toBe(true);
    expect(
      isPreviewInView(entry({ ratio: 0.5, rectHeight: 600, rootHeight: null })),
    ).toBe(false);
  });
});
