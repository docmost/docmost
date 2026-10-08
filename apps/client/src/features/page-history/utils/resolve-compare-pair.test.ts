import { describe, expect, it } from "vitest";
import { resolveComparePair } from "./resolve-compare-pair";

// list is newest-first, matching usePageHistoryListQuery order
const items = [{ id: "v3" }, { id: "v2" }, { id: "v1" }];

describe("resolveComparePair", () => {
  it("orders newer before older regardless of selection order", () => {
    expect(resolveComparePair(items, ["v1", "v3"])).toEqual({
      newerId: "v3",
      olderId: "v1",
    });
    expect(resolveComparePair(items, ["v3", "v1"])).toEqual({
      newerId: "v3",
      olderId: "v1",
    });
  });

  it("returns null unless exactly two versions are selected", () => {
    expect(resolveComparePair(items, [])).toBeNull();
    expect(resolveComparePair(items, ["v1"])).toBeNull();
    expect(resolveComparePair(items, ["v1", "v2", "v3"])).toBeNull();
  });

  it("returns null when a selected id is not in the list", () => {
    expect(resolveComparePair(items, ["v1", "missing"])).toBeNull();
  });

  it("returns null when the same id is selected twice", () => {
    expect(resolveComparePair(items, ["v2", "v2"])).toBeNull();
  });
});
