import { registry } from "@docmost/base-formula/client";
import type { FormulaFn } from "@docmost/base-formula/client";
import { describe, expect, it } from "vitest";
import { RESULT_TYPE_LABELS, formulaSignature } from "./formula-labels";

const label = (type: string) => (type === "any" ? "Value" : RESULT_TYPE_LABELS[type as keyof typeof RESULT_TYPE_LABELS]);
const fn = (name: string, min: number, max: number | null, paramTypes: FormulaFn["paramTypes"]) => ({
  name,
  arity: { min, max },
  paramTypes,
});

describe("result type labels", () => {
  it("name every result type and tell the two date kinds apart", () => {
    expect(RESULT_TYPE_LABELS).toEqual({
      number: "Number",
      string: "Text",
      boolean: "Checkbox",
      date: "Date",
      datetime: "Date and time",
      null: "Unknown",
    });
  });
});

describe("the function list", () => {
  it.each([
    "now", "today", "dateAdd", "dateSubtract", "dateBetween", "year", "month", "day",
    "hour", "minute", "weekday", "formatDate", "parseDate",
  ])("has %s under date, with help text", (name) => {
    const entry = registry.get(name.toLowerCase());
    expect(entry).toMatchObject({ name, category: "date" });
    expect(entry?.doc.trim().length).toBeGreaterThan(0);
  });
});

describe("formulaSignature", () => {
  it.each([
    [fn("today", 0, 0, []), "today()"],
    [fn("dateAdd", 3, 3, ["date", "number", "string"]), "dateAdd(Date, Number, Text)"],
    [fn("when", 1, 1, ["datetime"]), "when(Date and time)"],
    [fn("flag", 1, 1, ["boolean"]), "flag(Checkbox)"],
    [fn("round", 1, 2, ["number", "number"]), "round(Number, Number?)"],
    [fn("toNumber", 1, 1, "any"), "toNumber(Value)"],
    [fn("pick", 1, 2, "any"), "pick(Value, Value?)"],
    [fn("concat", 1, null, "variadic-any"), "concat(Value, ...)"],
  ])("writes %j as %s", (entry, text) => {
    expect(formulaSignature(entry, label)).toBe(text);
  });

  it.each([
    ["today", "today()"],
    ["dateAdd", "dateAdd(Date, Number, Text)"],
    ["dateBetween", "dateBetween(Date, Date, Text)"],
    ["round", "round(Number, Number?)"],
    ["concat", "concat(Value, ...)"],
  ])("writes the registered %s as %s", (name, text) => {
    expect(formulaSignature(registry.get(name.toLowerCase())!, label)).toBe(text);
  });
});
