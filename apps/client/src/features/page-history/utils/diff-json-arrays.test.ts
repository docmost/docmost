import { createPatch, Pointer } from "rfc6902";
import { describe, expect, it } from "vitest";
import { diffJsonArrays } from "@docmost/editor-ext";

const patch = (input: unknown[], output: unknown[]) =>
  diffJsonArrays(input, output, new Pointer());

// seeded so a failure reproduces
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("diffJsonArrays", () => {
  it("inserts a repeated element before its first match", () => {
    expect(patch(["a", "b"], ["a", "a", "b"])).toEqual([
      { op: "add", path: "/0", value: "a" },
    ]);
  });

  it("inserts by index when a common tail follows", () => {
    expect(patch(["a", "x"], ["a", "b", "x"])).toEqual([
      { op: "add", path: "/1", value: "b" },
    ]);
  });

  it("appends with - at the end", () => {
    expect(patch(["a"], ["a", "b"])).toEqual([
      { op: "add", path: "/-", value: "b" },
    ]);
  });

  it("shifts the index of each removal", () => {
    expect(patch([1, 2, 3], [])).toEqual([
      { op: "remove", path: "/0" },
      { op: "remove", path: "/0" },
      { op: "remove", path: "/0" },
    ]);
  });

  it("patches inside a changed element under its own path", () => {
    expect(
      createPatch(
        { content: [{ type: "text", text: "a" }] },
        { content: [{ type: "text", text: "b" }] },
        diffJsonArrays,
      ),
    ).toEqual([{ op: "replace", path: "/content/0/text", value: "b" }]);
  });

  it("ignores keys that hold undefined when matching", () => {
    expect(patch([{ type: "p" }, { a: 1, b: undefined }], [{ a: 1 }])).toEqual(
      [{ op: "remove", path: "/0" }],
    );
  });

  it("never matches NaN, like rfc6902", () => {
    expect(patch([NaN], [NaN])).toEqual([
      { op: "replace", path: "/0", value: NaN },
    ]);
  });

  it("leaves values other than arrays to rfc6902", () => {
    expect(diffJsonArrays({ a: 1 }, { a: 2 }, new Pointer())).toBeUndefined();
  });

  it("matches rfc6902 when the best path leaves the first band", () => {
    const input = Array.from({ length: 100 }, (_, i) => i);
    const output = [...input.slice(40), ...input.slice(0, 40)];

    expect(patch(input, output)).toStrictEqual(createPatch(input, output));
  });

  it("matches rfc6902 when most elements are removed", () => {
    const input = Array.from({ length: 200 }, (_, i) => i);
    const output = [7, 150, 1000, 199];

    expect(patch(input, output)).toStrictEqual(createPatch(input, output));
  });

  it("matches rfc6902 when most elements are added", () => {
    const input = [7, 150, 1000, 199];
    const output = Array.from({ length: 200 }, (_, i) => i);

    expect(patch(input, output)).toStrictEqual(createPatch(input, output));
  });

  it("matches rfc6902 on random edits", () => {
    const next = random(1);
    const values = [
      0,
      1,
      "a",
      null,
      { type: "p" },
      { type: "p", id: undefined },
      { type: "h", attrs: { level: 1 } },
      { type: "h", attrs: { level: 2 } },
      [1],
      [1, 2],
    ];
    const value = () => values[Math.floor(next() * values.length)];

    for (let run = 0; run < 300; run++) {
      const input = Array.from({ length: Math.floor(next() * 60) }, value);
      const output = input.slice();
      for (let edit = Math.floor(next() * 40); edit > 0; edit--) {
        const at = Math.floor(next() * (output.length + 1));
        const roll = next();
        if (roll < 0.33) output.splice(at, 0, value());
        else if (roll < 0.66) output.splice(at, 1);
        else output[at] = value();
      }

      expect(patch(input, output)).toStrictEqual(createPatch(input, output));
    }
  });
});
