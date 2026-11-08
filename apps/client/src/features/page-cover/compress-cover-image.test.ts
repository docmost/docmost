import { describe, expect, it } from "vitest";
import {
  getCoverOutputType,
  pickSmallerCoverFile,
  withCoverExtension,
} from "./compress-cover-image";

const MB = 1024 * 1024;

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
    ["anim.gif", "image/gif", "anim.gif"],
    ["shot.png", "image/webp", "shot.webp"],
  ])("%s (%s) is uploaded as %s", (name, type, expected) => {
    const result = withCoverExtension(file(name, type));
    expect(result.name).toBe(expected);
    expect(result.type).toBe(type);
  });
});
