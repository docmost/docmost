import { describe, expect, it } from "vitest";
import type { FilterNode } from "@/ee/base/types/base.types";
import { rowsDateKey } from "./rows-date-key";

const viewer = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
const where = (...values: unknown[]): FilterNode => ({
  op: "and",
  children: values.map((value) => ({ propertyId: "due", op: "eq", value })),
} as FilterNode);

describe("rowsDateKey", () => {
  it.each([
    ["no filter", undefined],
    ["a filter without dates", where("text", ["a"], 5, true, null)],
    ["is empty on a date", { op: "and", children: [{ propertyId: "due", op: "isEmpty" }] } as FilterNode],
  ])("is undefined for %s", (_name, filter) => {
    expect(rowsDateKey(filter, viewer)).toBeUndefined();
  });

  it.each([
    ["an exact day", { mode: "exact", date: "2026-11-12" }, { timeZone: "America/New_York" }],
    ["an exact operand holding an instant", { mode: "exact", date: "2026-11-12T00:00:00.000Z" }, { timeZone: "America/New_York" }],
    ["a relative day", { mode: "relative", preset: "tomorrow" }, { timeZone: "America/New_York", today: "2026-11-12" }],
    ["a rolling period", { mode: "range", preset: "pastMonth" }, { timeZone: "America/New_York", today: "2026-11-12" }],
    [
      "this week",
      { mode: "range", preset: "thisWeek" },
      { timeZone: "America/New_York", today: "2026-11-12", weekStart: 0 },
    ],
  ])("carries what %s depends on", (_name, value, key) => {
    expect(rowsDateKey(where(value), viewer)).toEqual(key);
  });

  it("looks inside nested groups and adds up what it finds", () => {
    const filter: FilterNode = {
      op: "or",
      children: [
        where({ mode: "exact", date: "2026-11-12" }),
        { op: "and", children: [where({ mode: "range", preset: "thisWeek" })] },
      ],
    };
    expect(rowsDateKey(filter, viewer)).toEqual({ timeZone: "America/New_York", today: "2026-11-12", weekStart: 0 });
  });
});
