import { afterEach, describe, expect, it, vi } from "vitest";
import { isPreviewInView } from "./preview-visibility";

type Entry = Parameters<typeof isPreviewInView>[0] &
  Pick<IntersectionObserverEntry, "intersectionRatio">;

const rect = (height: number) => ({ height }) as DOMRectReadOnly;

const entry = (init: {
  ratio: number;
  rectHeight: number;
  boundingHeight: number;
  rootHeight: number | null;
}): Entry => ({
  isIntersecting: true,
  intersectionRatio: init.ratio,
  intersectionRect: rect(init.rectHeight),
  boundingClientRect: rect(init.boundingHeight),
  rootBounds: init.rootHeight === null ? null : rect(init.rootHeight),
});

describe("isPreviewInView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when the embed is off screen", () => {
    const fullyVisible = entry({
      ratio: 1,
      rectHeight: 600,
      boundingHeight: 600,
      rootHeight: 800,
    });

    expect(isPreviewInView({ ...fullyVisible, isIntersecting: false })).toBe(
      false,
    );
  });

  it("is true once a short embed is fully on screen", () => {
    expect(
      isPreviewInView(
        entry({
          ratio: 1,
          rectHeight: 600,
          boundingHeight: 600,
          rootHeight: 800,
        }),
      ),
    ).toBe(true);
  });

  it("loads a horizontally clipped embed that is fully visible vertically", () => {
    expect(
      isPreviewInView(
        entry({
          ratio: 0.316,
          rectHeight: 600,
          boundingHeight: 600,
          rootHeight: 844,
        }),
      ),
    ).toBe(true);
  });

  it("does not load an embed only partly visible vertically", () => {
    expect(
      isPreviewInView(
        entry({
          ratio: 0.5,
          rectHeight: 300,
          boundingHeight: 600,
          rootHeight: 844,
        }),
      ),
    ).toBe(false);
  });

  it("is true when a tall embed fills the screen", () => {
    expect(
      isPreviewInView(
        entry({
          ratio: 0.5,
          rectHeight: 760,
          boundingHeight: 1500,
          rootHeight: 800,
        }),
      ),
    ).toBe(true);
  });

  it("is false for a tall embed that only covers part of the screen", () => {
    expect(
      isPreviewInView(
        entry({
          ratio: 0.4,
          rectHeight: 480,
          boundingHeight: 1200,
          rootHeight: 800,
        }),
      ),
    ).toBe(false);
  });

  it.each([
    [570, true],
    [569, false],
  ])(
    "judges an embed with %i of its 600px visible against the 95% bar",
    (rectHeight, expected) => {
      expect(
        isPreviewInView(
          entry({
            ratio: rectHeight / 600,
            rectHeight,
            boundingHeight: 600,
            rootHeight: 844,
          }),
        ),
      ).toBe(expected);
    },
  );

  it.each([
    [720, true],
    [719, false],
  ])(
    "judges a tall embed covering %i of an 800px screen against the 90% bar",
    (rectHeight, expected) => {
      expect(
        isPreviewInView(
          entry({
            ratio: rectHeight / 2000,
            rectHeight,
            boundingHeight: 2000,
            rootHeight: 800,
          }),
        ),
      ).toBe(expected);
    },
  );

  it("loads a fully visible embed without rootBounds", () => {
    expect(
      isPreviewInView(
        entry({
          ratio: 1,
          rectHeight: 600,
          boundingHeight: 600,
          rootHeight: null,
        }),
      ),
    ).toBe(true);
  });

  it("uses window.innerHeight without rootBounds", () => {
    vi.stubGlobal("innerHeight", 1000);

    const tallEmbed = (rectHeight: number) =>
      entry({
        ratio: rectHeight / 2000,
        rectHeight,
        boundingHeight: 2000,
        rootHeight: null,
      });

    expect(isPreviewInView(tallEmbed(900))).toBe(true);
    expect(isPreviewInView(tallEmbed(899))).toBe(false);
  });

  it("prefers rootBounds over window.innerHeight", () => {
    vi.stubGlobal("innerHeight", 1000);

    expect(
      isPreviewInView(
        entry({
          ratio: 0.36,
          rectHeight: 720,
          boundingHeight: 2000,
          rootHeight: 800,
        }),
      ),
    ).toBe(true);
  });
});
