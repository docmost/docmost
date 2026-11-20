import { describe, expect, it } from "vitest";
import { includeSpace } from "./space.utils";

const active = { id: "a", name: "Active" } as any;
const archived = { id: "b", name: "Old", archivedAt: new Date() } as any;

describe("includeSpace", () => {
  it("adds the archived space you are in to a list that left it out", () => {
    expect(includeSpace([active], archived).map((s) => s.id)).toEqual(["b", "a"]);
  });
  it("does not duplicate a space already in the list", () => {
    expect(includeSpace([active], active)).toHaveLength(1);
  });
  it("returns the list unchanged without a space", () => {
    expect(includeSpace([active], undefined)).toEqual([active]);
  });
});
