import { describe, expect, it } from "vitest";
import {
  getCoverOverflow,
  getCoverPosition,
  getCoverPositionAfterDrag,
  pickRandomGradient,
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
    [`/api/files/${FILE_ID}/..`],
    [`/api/files/${FILE_ID}/.`],
    [`/api/files/${FILE_ID}/a\\b.png`],
    [""],
    [null],
    [undefined],
  ])("renders nothing for %s", (value) => {
    expect(resolveCover(value)).toBeNull();
  });

  it.each([[1], [true], [{}], [["preset:color-red"]]])(
    "renders nothing for a non-string %o from another client",
    (value) => {
      expect(resolveCover(value)).toBeNull();
    },
  );
});

describe("getCoverPosition", () => {
  it.each([
    [42, 42],
    [0, 0],
    [100, 100],
    [150, 100],
    [-5, 0],
    [null, 50],
    [undefined, 50],
    ["30", 50],
    [Number.NaN, 50],
    [Number.POSITIVE_INFINITY, 50],
  ])("%o -> %d", (value, expected) => {
    expect(getCoverPosition(value)).toBe(expected);
  });
});

describe("pickRandomGradient", () => {
  const calm = [
    "gradient-sky",
    "gradient-slate",
    "gradient-dusk",
    "gradient-aurora",
    "gradient-dune",
  ];

  it("only picks calm gradients and never repeats the current cover", () => {
    const picked = new Set<string>();
    for (let i = 0; i < 300; i++) {
      picked.add(pickRandomGradient("preset:gradient-sky").id);
    }
    expect([...picked].sort()).toEqual(
      calm.filter((id) => id !== "gradient-sky").sort(),
    );
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
