import { describe, it, expect, vi } from "vitest";

vi.mock("fractional-indexing-jittered", () => ({
  generateJitteredKeyBetween: (a: string | null, b: string | null) =>
    `${a ?? "START"}|${b ?? "END"}`,
}));

import { resolveCardDrop } from "../resolve-card-drop";
import { NO_VALUE_CHOICE_ID } from "@/features/base/types/base.types";

const mkRow = (id: string, position: string) =>
  ({ id, position, cells: {} }) as any;

describe("resolveCardDrop", () => {
  it("returns cells-only when cross-column drop happens with sort active", () => {
    const result = resolveCardDrop({
      draggedCardId: "r1",
      targetCardId: "r2",
      edge: "top",
      sourceColumnKey: "c1",
      targetColumnKey: "c2",
      groupByPropertyId: "prop-status",
      columnRows: [mkRow("r2", "b")],
      sortsActive: true,
    });
    expect(result.cells).toEqual({ "prop-status": "c2" });
    expect(result.position).toBeUndefined();
  });

  it("writes null cell value when target is the NO_VALUE column", () => {
    const result = resolveCardDrop({
      draggedCardId: "r1",
      targetCardId: "r2",
      edge: "top",
      sourceColumnKey: "c1",
      targetColumnKey: NO_VALUE_CHOICE_ID,
      groupByPropertyId: "prop-status",
      columnRows: [mkRow("r2", "b")],
      sortsActive: false,
    });
    expect(result.cells).toEqual({ "prop-status": null });
  });

  it("returns position-only when intra-column drop with no sort", () => {
    const result = resolveCardDrop({
      draggedCardId: "r1",
      targetCardId: "r2",
      edge: "bottom",
      sourceColumnKey: "c1",
      targetColumnKey: "c1",
      groupByPropertyId: "prop-status",
      columnRows: [mkRow("r2", "a"), mkRow("r3", "c")],
      sortsActive: false,
    });
    expect(result.cells).toBeUndefined();
    expect(typeof result.position).toBe("string");
    // Between 'a' (r2) and 'c' (r3) → some key, exact value depends on jitter
    // but must satisfy 'a' < key < 'c' for typical jitter outputs.
    expect(result.position! > "a").toBe(true);
    expect(result.position! < "c").toBe(true);
  });

  it("returns both cells and position for cross-column with slot", () => {
    const result = resolveCardDrop({
      draggedCardId: "r1",
      targetCardId: "r2",
      edge: "top",
      sourceColumnKey: "c1",
      targetColumnKey: "c2",
      groupByPropertyId: "prop-status",
      columnRows: [mkRow("r2", "b"), mkRow("r3", "d")],
      sortsActive: false,
    });
    expect(result.cells).toEqual({ "prop-status": "c2" });
    expect(typeof result.position).toBe("string");
    expect(result.position! < "b").toBe(true);
  });

  it("appends to the end when targetCardId is not in columnRows (empty/below-last)", () => {
    const result = resolveCardDrop({
      draggedCardId: "r1",
      targetCardId: "__column-body__", // sentinel
      edge: "bottom",
      sourceColumnKey: "c1",
      targetColumnKey: "c2",
      groupByPropertyId: "prop-status",
      columnRows: [mkRow("r5", "z")],
      sortsActive: false,
    });
    expect(result.cells).toEqual({ "prop-status": "c2" });
    expect(result.position! > "z").toBe(true);
  });

  it("returns undefined for both fields when same column and sort active", () => {
    const result = resolveCardDrop({
      draggedCardId: "r1",
      targetCardId: "r2",
      edge: "top",
      sourceColumnKey: "c1",
      targetColumnKey: "c1",
      groupByPropertyId: "prop-status",
      columnRows: [mkRow("r2", "a")],
      sortsActive: true,
    });
    expect(result.cells).toBeUndefined();
    expect(result.position).toBeUndefined();
  });
});
