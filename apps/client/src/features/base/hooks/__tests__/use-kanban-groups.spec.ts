import { describe, it, expect } from "vitest";
import { partitionRowsByGroup } from "../use-kanban-groups";
import { NO_VALUE_CHOICE_ID } from "@/features/base/types/base.types";

describe("partitionRowsByGroup", () => {
  const property = {
    id: "p1",
    type: "status",
    typeOptions: {
      choices: [
        { id: "c1", name: "Todo", color: "blue" },
        { id: "c2", name: "Done", color: "green" },
      ],
      choiceOrder: ["c1", "c2"],
    },
  } as any;

  const rows = [
    { id: "r1", cells: { p1: "c1" }, position: "a0" },
    { id: "r2", cells: { p1: "c2" }, position: "a1" },
    { id: "r3", cells: {}, position: "a2" },
    { id: "r4", cells: { p1: "c1" }, position: "a3" },
  ] as any;

  it("groups rows under the choice id their cell points at", () => {
    const result = partitionRowsByGroup(rows, property, undefined, undefined);
    expect(result.columns.map((c) => c.key)).toEqual([
      NO_VALUE_CHOICE_ID,
      "c1",
      "c2",
    ]);
    expect(result.columns[1].rows.map((r) => r.id)).toEqual(["r1", "r4"]);
    expect(result.columns[2].rows.map((r) => r.id)).toEqual(["r2"]);
  });

  it("puts rows without the cell into the NO_VALUE column", () => {
    const result = partitionRowsByGroup(rows, property, undefined, undefined);
    expect(result.columns[0].key).toBe(NO_VALUE_CHOICE_ID);
    expect(result.columns[0].rows.map((r) => r.id)).toEqual(["r3"]);
  });

  it("hides columns listed in hiddenChoiceIds", () => {
    const result = partitionRowsByGroup(rows, property, ["c2"], undefined);
    expect(result.columns.map((c) => c.key)).toEqual([NO_VALUE_CHOICE_ID, "c1"]);
  });

  it("respects an override choiceOrder", () => {
    const result = partitionRowsByGroup(
      rows,
      property,
      undefined,
      ["c2", "c1", NO_VALUE_CHOICE_ID],
    );
    expect(result.columns.map((c) => c.key)).toEqual([
      "c2",
      "c1",
      NO_VALUE_CHOICE_ID,
    ]);
  });

  it("appends newly-added choices (missing from override choiceOrder) at the end", () => {
    const result = partitionRowsByGroup(
      rows,
      property,
      undefined,
      ["c1"], // missing c2 and NO_VALUE
    );
    expect(result.columns.map((c) => c.key)).toEqual([
      "c1",
      NO_VALUE_CHOICE_ID,
      "c2",
    ]);
  });

  it("drops entries in choiceOrder that no longer exist on the property", () => {
    const result = partitionRowsByGroup(
      rows,
      property,
      undefined,
      ["c1", "deleted-choice", "c2"],
    );
    expect(result.columns.map((c) => c.key)).toEqual(["c1", "c2"]);
  });

  it("returns null columns when groupByPropertyId is unset", () => {
    const result = partitionRowsByGroup(rows, undefined, undefined, undefined);
    expect(result.columns).toEqual([]);
  });

  it("preserves row order within a column (input order)", () => {
    const rowsOutOfOrder = [
      { id: "r1", cells: { p1: "c1" }, position: "b" },
      { id: "r2", cells: { p1: "c1" }, position: "a" },
    ] as any;
    const result = partitionRowsByGroup(
      rowsOutOfOrder,
      property,
      undefined,
      undefined,
    );
    expect(result.columns[1].rows.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});
