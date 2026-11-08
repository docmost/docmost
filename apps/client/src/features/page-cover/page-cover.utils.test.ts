import { describe, expect, it } from "vitest";
import {
  getCoverOutputType,
  getCoverOverflow,
  getCoverPositionAfterDrag,
  pickSmallerCoverFile,
  resolveCover,
} from "./page-cover.utils";

const FILE_ID = "019a1f00-0000-7000-8000-0000000000aa";

describe("resolveCover", () => {
  it("resolves a color preset to its color", () => {
    expect(resolveCover("preset:color-red")).toEqual({
      kind: "color",
      color: "#d6645a",
    });
  });

  it("resolves an image preset to its bundled image", () => {
    const cover = resolveCover("preset:gradient-aurora");
    expect(cover?.kind).toBe("image");
    expect(cover?.kind === "image" && cover.src).toMatch(/gradient-aurora/);
    expect(cover?.kind === "image" && cover.src).not.toMatch(/thumb/);
  });

  it("resolves an uploaded cover to the file endpoint", () => {
    const cover = resolveCover(`/api/files/${FILE_ID}/team offsite.jpg`);
    expect(cover?.kind).toBe("image");
    expect(cover?.kind === "image" && cover.src).toMatch(
      new RegExp(`/api/files/${FILE_ID}/team offsite\\.jpg$`),
    );
  });

  it("resolves a tokenized public cover", () => {
    const cover = resolveCover(
      `/api/files/public/${FILE_ID}/cover.jpg?jwt=eyJh.eyJw.sig-_`,
    );
    expect(cover?.kind).toBe("image");
  });

  it.each([
    ["preset:does-not-exist"],
    ["https://tracker.example/pixel.png"],
    ["//tracker.example/pixel.png"],
    ["javascript:alert(1)"],
    [`/api/files/${FILE_ID}/cover.jpg?w=1`],
    [`/api/files/${FILE_ID}/../../secret`],
    [""],
    [null],
    [undefined],
  ])("renders nothing for %s", (value) => {
    expect(resolveCover(value)).toBeNull();
  });
});

describe("getCoverOverflow", () => {
  it.each([
    [{ width: 2400, height: 800 }, { width: 1200, height: 280 }, 120],
    [{ width: 1000, height: 1000 }, { width: 1000, height: 250 }, 750],
    [{ width: 2400, height: 400 }, { width: 1200, height: 280 }, 0],
    [{ width: 0, height: 0 }, { width: 1200, height: 280 }, 0],
  ])("image %o in box %o overflows by %d px", (natural, box, expected) => {
    expect(getCoverOverflow(natural, box)).toBeCloseTo(expected);
  });
});

describe("getCoverPositionAfterDrag", () => {
  it.each([
    [50, 60, 120, 0],
    [50, -30, 120, 75],
    [50, 500, 120, 0],
    [50, -500, 120, 100],
    [40, 10, 0, 40],
  ])(
    "from %d%% dragged %dpx with %dpx overflow lands at %d%%",
    (start, deltaY, overflow, expected) => {
      expect(getCoverPositionAfterDrag(start, deltaY, overflow)).toBeCloseTo(
        expected,
      );
    },
  );
});

describe("pickSmallerCoverFile", () => {
  const file = (size: number, name: string) =>
    new File([new Uint8Array(size)], name);

  it("keeps the original when re-encoding without downscaling made it bigger", () => {
    const original = file(6_000, "diagram.png");
    const encoded = file(9_000, "diagram.webp");
    expect(pickSmallerCoverFile(original, encoded, false)).toBe(original);
  });

  it("uses the re-encoded file when it is smaller", () => {
    const original = file(9_000, "photo.jpg");
    const encoded = file(2_000, "photo.jpg");
    expect(pickSmallerCoverFile(original, encoded, false)).toBe(encoded);
  });

  it("always uses the downscaled file", () => {
    const original = file(6_000, "huge.png");
    const encoded = file(7_000, "huge.webp");
    expect(pickSmallerCoverFile(original, encoded, true)).toBe(encoded);
  });
});

describe("getCoverOutputType", () => {
  const MB = 1024 * 1024;
  const opaque = () => false;
  const transparent = () => true;

  it.each([
    ["a small photo that fits", "image/jpeg", 0.8 * MB, false, opaque, "original"],
    ["a large photo", "image/jpeg", 4 * MB, false, opaque, "image/jpeg"],
    ["a small photo that was downscaled", "image/jpeg", 0.8 * MB, true, opaque, "image/jpeg"],
    ["a large png with transparency", "image/png", 3 * MB, false, transparent, "image/webp"],
    ["a large opaque png", "image/png", 3 * MB, false, opaque, "image/jpeg"],
    ["a large webp with transparency", "image/webp", 3 * MB, true, transparent, "image/webp"],
    ["an animated gif", "image/gif", 6 * MB, true, opaque, "original"],
  ])("%s -> %s", (_label, type, size, downscaled, hasAlpha, expected) => {
    expect(getCoverOutputType({ type, size }, downscaled, hasAlpha)).toBe(
      expected,
    );
  });

  it("only checks transparency when it matters", () => {
    let checked = false;
    getCoverOutputType({ type: "image/jpeg", size: 4 * MB }, false, () => {
      checked = true;
      return false;
    });
    expect(checked).toBe(false);
  });
});
