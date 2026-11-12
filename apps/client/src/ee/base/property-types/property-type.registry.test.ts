import { describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

import { filterSpecOf, isPropertyConverting } from "./property-type.registry";

describe("isPropertyConverting", () => {
  it.each([
    [{}, false],
    [{ pendingType: null, pendingTypeOptions: null }, false],
    [{ pendingType: "number" as const }, true],
    [{ pendingType: null, pendingTypeOptions: { includeTime: true } }, true],
    [{ pendingType: "date" as const, pendingTypeOptions: { includeTime: false } }, true],
  ])("reads %j as %s", (property, converting) => {
    expect(isPropertyConverting(property)).toBe(converting);
  });
});

const DATE_OPERATORS = ["eq", "before", "after", "onOrBefore", "onOrAfter", "isWithin", "isEmpty", "isNotEmpty"];
const formula = (resultType: string) => ({ type: "formula" as const, typeOptions: { resultType } });

describe("filterSpecOf", () => {
  it.each([
    [{ type: "date", typeOptions: {} }],
    [{ type: "date", typeOptions: { includeTime: true } }],
    [{ type: "createdAt", typeOptions: {} }],
    [{ type: "lastEditedAt", typeOptions: {} }],
    [formula("date")],
    [formula("datetime")],
  ])("offers the date operators and the date input for %j", (property) => {
    expect(filterSpecOf(property as never)).toEqual({ operators: DATE_OPERATORS, input: "date" });
  });

  it.each([
    ["number", ["eq", "neq", "gt", "lt", "isEmpty", "isNotEmpty"], "number"],
    ["string", ["eq", "neq", "contains", "ncontains", "isEmpty", "isNotEmpty"], "text"],
    ["boolean", ["eq", "isEmpty", "isNotEmpty"], "boolean"],
    ["null", ["isEmpty", "isNotEmpty"], "text"],
  ])("offers a formula of result type %s the operators of that type", (resultType, operators, input) => {
    expect(filterSpecOf(formula(resultType) as never)).toEqual({ operators, input });
  });
});
