import { describe, expect, it } from "vitest";
import {
  getCoverAttribution,
  getCoverCredit,
  getCoverOverflow,
  getCoverPosition,
  getCoverPositionAfterDrag,
  getUnsplashProfileUrl,
  isSameUnsplashPhoto,
  mergeUnsplashPages,
  pickRandomGradient,
  resolveCover,
  toCssUrl,
} from "./page-cover.utils";
import { UNSPLASH_HOME_URL } from "./page-cover.constants";
import { UnsplashPhoto } from "./page-cover.types";

describe("isSameUnsplashPhoto", () => {
  const photo = (photoId: string, ixid: string) => ({
    coverPhoto: `https://images.unsplash.com/photo-${photoId}?ixid=${ixid}&w=2560`,
    coverAttribution: {
      source: "unsplash" as const,
      photoId,
      authorName: "Ada",
      authorUsername: "ada",
    },
  });

  it("matches the same photo saved under a new address", () => {
    expect(isSameUnsplashPhoto(photo("a1", "search"), photo("a1", "all"))).toBe(
      true,
    );
  });

  it("tells different photos apart", () => {
    expect(isSameUnsplashPhoto(photo("a1", "x"), photo("b2", "x"))).toBe(false);
  });

  it("never matches a cover that is not an Unsplash photo", () => {
    const preset = { coverPhoto: "preset:gradient-sky", coverAttribution: null };
    expect(isSameUnsplashPhoto(preset, photo("a1", "x"))).toBe(false);
    expect(isSameUnsplashPhoto(undefined, photo("a1", "x"))).toBe(false);
  });
});

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

  it("resolves an Unsplash photo to its hotlinked address", () => {
    const src =
      "https://images.unsplash.com/photo-1?ixid=abc&w=2560&q=80&auto=format&fit=max";
    expect(resolveCover(src)).toEqual({ kind: "image", src });
  });

  it.each([
    ["http://images.unsplash.com/photo-1"],
    ["https://images.unsplash.com.evil.example/photo-1"],
    ["https://evil.example/?https://images.unsplash.com/photo-1"],
    ["https://user@images.unsplash.com/photo-1"],
    ["https://images.unsplash.com:8443/photo-1"],
  ])("renders nothing for a lookalike Unsplash address %s", (value) => {
    expect(resolveCover(value)).toBeNull();
  });
});

describe("getCoverAttribution", () => {
  const credit = {
    source: "unsplash",
    photoId: "Abc_123",
    authorName: "Ada Lovelace",
    authorUsername: "ada",
  };

  it("keeps a valid Unsplash credit", () => {
    expect(getCoverAttribution(credit)).toEqual(credit);
  });

  it.each([
    [null],
    [undefined],
    ["unsplash"],
    [{ ...credit, source: "pexels" }],
    [{ ...credit, authorName: 42 }],
    [{ ...credit, authorName: "" }],
    [{ ...credit, authorUsername: "ada/../../x" }],
    [{ ...credit, authorUsername: undefined }],
  ])("drops %o", (value) => {
    expect(getCoverAttribution(value)).toBeNull();
  });
});

describe("getCoverCredit", () => {
  const credit = {
    source: "unsplash",
    photoId: "Abc_123",
    authorName: "Ada Lovelace",
    authorUsername: "ada",
  };

  it("credits the photographer of an Unsplash cover", () => {
    expect(
      getCoverCredit("https://images.unsplash.com/photo-1?w=2560", credit),
    ).toEqual(credit);
  });

  it("ignores a credit left over next to another cover", () => {
    expect(getCoverCredit("preset:gradient-aurora", credit)).toBeNull();
    expect(getCoverCredit(`/api/files/${FILE_ID}/cover.jpg`, credit)).toBeNull();
  });
});

describe("toCssUrl", () => {
  it("quotes the address and escapes quotes and backslashes", () => {
    expect(toCssUrl('https://images.unsplash.com/a?b="c"\\d')).toBe(
      'url("https://images.unsplash.com/a?b=\\"c\\"\\\\d")',
    );
  });
});

describe("Unsplash links", () => {
  it("credits the photographer and Unsplash with referral tags", () => {
    expect(getUnsplashProfileUrl("ada")).toBe(
      "https://unsplash.com/@ada?utm_source=docmost&utm_medium=referral",
    );
    expect(UNSPLASH_HOME_URL).toBe(
      "https://unsplash.com/?utm_source=docmost&utm_medium=referral",
    );
  });
});

describe("mergeUnsplashPages", () => {
  const photo = (id: string): UnsplashPhoto => ({
    id,
    description: null,
    color: null,
    thumbUrl: `https://images.unsplash.com/photo-${id}?w=400`,
    coverUrl: `https://images.unsplash.com/photo-${id}?w=2560`,
    authorName: "Ada",
    authorUsername: "ada",
  });

  it("keeps each photo once when a later page repeats it", () => {
    const pages = [
      { items: [photo("a"), photo("b")], hasMore: true },
      { items: [photo("b"), photo("c")], hasMore: false },
    ];
    expect(mergeUnsplashPages(pages).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
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
