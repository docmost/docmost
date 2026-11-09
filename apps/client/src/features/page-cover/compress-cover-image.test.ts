import { describe, expect, it } from "vitest";
import {
  encodeWithinLimit,
  getCoverOutputType,
  pickSmallerCoverFile,
  withCoverExtension,
} from "./compress-cover-image";

const MB = 1024 * 1024;

describe("encodeWithinLimit", () => {
  const sized = (size: number, type = "image/jpeg") =>
    new File([new Uint8Array(size)], "cover", { type });

  it("lowers the quality first, then the size, until the file fits", async () => {
    const calls: string[] = [];
    const encode = async (scale: number, quality: number) => {
      calls.push(`${scale}@${quality}`);
      return sized(scale === 0.75 && quality === 0.55 ? 4 * MB : 6 * MB);
    };

    const file = await encodeWithinLimit(encode, 5 * MB);

    expect(file?.size).toBe(4 * MB);
    expect(calls).toEqual([
      "1@0.85",
      "1@0.7",
      "1@0.55",
      "1@0.4",
      "0.75@0.85",
      "0.75@0.7",
      "0.75@0.55",
    ]);
  });

  it("only shrinks a png, whose quality setting does nothing", async () => {
    const calls: string[] = [];
    const encode = async (scale: number, quality: number) => {
      calls.push(`${scale}@${quality}`);
      return sized(scale < 0.6 ? 3 * MB : 8 * MB, "image/png");
    };

    const file = await encodeWithinLimit(encode, 5 * MB);

    expect(file?.type).toBe("image/png");
    expect(calls).toEqual(["1@0.85", "0.75@0.85", "0.5625@0.85"]);
  });

  it("gives up when nothing fits", async () => {
    expect(await encodeWithinLimit(async () => sized(9 * MB), 5 * MB)).toBeNull();
  });
});

describe("getCoverOutputType", () => {
  const opaque = () => false;
  const transparent = () => true;

  it.each([
    ["a small photo that fits", "image/jpeg", 0.8 * MB, false, opaque, "original"],
    ["a large photo", "image/jpeg", 4 * MB, false, opaque, "image/jpeg"],
    ["a small photo that was downscaled", "image/jpeg", 0.8 * MB, true, opaque, "image/jpeg"],
    ["a large png with transparency", "image/png", 3 * MB, false, transparent, "image/webp"],
    ["a large opaque png", "image/png", 3 * MB, false, opaque, "image/jpeg"],
    ["a large webp with transparency", "image/webp", 3 * MB, true, transparent, "image/webp"],
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

describe("withCoverExtension", () => {
  const file = (name: string, type: string) =>
    new File([new Uint8Array(4)], name, { type });

  it.each([
    ["photo.jfif", "image/jpeg", "photo.jpg"],
    ["cover", "image/png", "cover.png"],
    ["scan.jpeg", "image/jpeg", "scan.jpeg"],
    ["Holiday.JPG", "image/jpeg", "Holiday.JPG"],
    ["shot.png", "image/webp", "shot.webp"],
  ])("%s (%s) is uploaded as %s", (name, type, expected) => {
    const result = withCoverExtension(file(name, type));
    expect(result.name).toBe(expected);
    expect(result.type).toBe(type);
  });
});
