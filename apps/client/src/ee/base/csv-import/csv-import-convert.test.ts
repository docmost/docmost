import { describe, expect, it } from "vitest";
import { convertCsvValue } from "./csv-import-convert";
import type { CsvParseHints } from "./csv-import.types";

const hints: CsvParseHints = {
  dateOrder: "MDY",
  decimalSeparator: ".",
  listSeparator: ",",
};

describe("convertCsvValue", () => {
  it("returns empty for blank values on every type", () => {
    expect(convertCsvValue("  ", "number", hints)).toEqual({ value: null, status: "empty" });
    expect(convertCsvValue(undefined, "text", hints)).toEqual({ value: null, status: "empty" });
  });

  it("keeps null markers as text but empties them for typed targets", () => {
    expect(convertCsvValue("N/A", "text", hints)).toEqual({ value: "N/A", status: "ok" });
    expect(convertCsvValue("N/A", "select", hints)).toEqual({ value: "N/A", status: "ok" });
    expect(convertCsvValue("N/A", "number", hints)).toEqual({ value: null, status: "empty" });
    expect(convertCsvValue("N/A", "date", hints)).toEqual({ value: null, status: "empty" });
  });

  it("truncates text and long text at their limits", () => {
    const result = convertCsvValue("x".repeat(1005), "text", hints);
    expect(result.status).toBe("truncated");
    expect((result.value as string).length).toBe(1000);
    expect(convertCsvValue("a\nb", "longText", hints)).toEqual({ value: "a\nb", status: "ok" });
  });

  it("does not split a surrogate pair when truncating", () => {
    expect(convertCsvValue(`${"a".repeat(999)}😀b`, "text", hints)).toEqual({
      value: "a".repeat(999),
      status: "truncated",
    });
  });

  it("strips the export's formula apostrophe from text-like values only", () => {
    expect(convertCsvValue("'=1+1", "text", hints).value).toBe("=1+1");
    expect(convertCsvValue("'-note", "longText", hints).value).toBe("-note");
    expect(convertCsvValue("'@team", "select", hints).value).toBe("@team");
    expect(convertCsvValue("'+a, '-b", "multiSelect", hints).value).toEqual(["+a", "-b"]);
    expect(convertCsvValue("'-Ada", "person", hints).value).toEqual(["-Ada"]);
    expect(convertCsvValue("'=5", "number", hints).status).toBe("invalid");
  });

  it("converts typed values", () => {
    expect(convertCsvValue("$1,200.50", "number", hints).value).toBe(1200.5);
    expect(convertCsvValue("3,5", "number", { ...hints, decimalSeparator: "," }).value).toBe(3.5);
    expect(convertCsvValue("2026-11-13", "date", hints).value).toBe("2026-11-13T00:00:00.000Z");
    expect(convertCsvValue("Yes", "checkbox", hints).value).toBe(true);
    expect(convertCsvValue("no", "checkbox", hints).value).toBe(false);
    expect(convertCsvValue("www.docmost.com", "url", hints).value).toBe("https://www.docmost.com");
    expect(convertCsvValue("ada@example.com", "email", hints).value).toBe("ada@example.com");
  });

  it("marks unreadable typed values invalid", () => {
    expect(convertCsvValue("abc", "number", hints)).toEqual({ value: null, status: "invalid" });
    expect(convertCsvValue("soon", "date", hints).status).toBe("invalid");
    expect(convertCsvValue("maybe", "checkbox", hints).status).toBe("invalid");
    expect(convertCsvValue("not an email", "email", hints).status).toBe("invalid");
  });

  it("splits multi-select and person values", () => {
    expect(convertCsvValue("Bug, UI, bug", "multiSelect", hints)).toEqual({
      value: ["Bug", "UI"],
      status: "ok",
    });
    expect(convertCsvValue("a; b", "multiSelect", { ...hints, listSeparator: ";" }).value).toEqual([
      "a",
      "b",
    ]);
    expect(convertCsvValue("Ada <ada@example.com>, Bob", "person", hints).value).toEqual([
      "ada@example.com",
      "Bob",
    ]);
  });

  it("rejects choice names over 255 characters", () => {
    expect(convertCsvValue("x".repeat(256), "select", hints).status).toBe("invalid");
    const mixed = convertCsvValue(`ok, ${"x".repeat(256)}`, "multiSelect", hints);
    expect(mixed).toEqual({ value: ["ok"], status: "truncated", skipped: 1 });
  });

  it("counts multi-select items it leaves out", () => {
    const long = "x".repeat(256);
    expect(convertCsvValue(`${long}, y${long}`, "multiSelect", hints)).toEqual({
      value: null,
      status: "invalid",
      skipped: 2,
    });
    const tags = Array.from({ length: 150 }, (_, i) => `Tag ${i}`).join(", ");
    const capped = convertCsvValue(tags, "multiSelect", hints);
    expect((capped.value as string[]).length).toBe(100);
    expect(capped).toMatchObject({ status: "truncated", skipped: 50 });
    expect(convertCsvValue(", ,", "multiSelect", hints)).toEqual({ value: null, status: "empty" });
  });
});
