import { describe, expect, it } from "vitest";
import {
  isNullMarker,
  localeDateOrder,
  localeDecimalSeparator,
  normalizeEmail,
  normalizeUrl,
  parseBooleanValue,
  parseDateValue,
  parseNumberValue,
  personToken,
  splitListValue,
  stripFormulaApostrophe,
  truncateText,
} from "./csv-value-parsers";

describe("parseNumberValue", () => {
  it("reads plain, grouped and scientific numbers with a period decimal", () => {
    expect(parseNumberValue("42", ".")?.value).toBe(42);
    expect(parseNumberValue("-3.5", ".")?.value).toBe(-3.5);
    expect(parseNumberValue("1,234,567.89", ".")?.value).toBe(1234567.89);
    expect(parseNumberValue("1e3", ".")?.value).toBe(1000);
    expect(parseNumberValue(".5", ".")?.value).toBe(0.5);
  });

  it("reads comma decimals and period or space grouping", () => {
    expect(parseNumberValue("3,5", ",")?.value).toBe(3.5);
    expect(parseNumberValue("1.234,56", ",")?.value).toBe(1234.56);
    expect(parseNumberValue("1 234,5", ",")?.value).toBe(1234.5);
    expect(parseNumberValue("1 234 567", ",")?.value).toBe(1234567);
  });

  it("rejects values that only fit the other decimal separator", () => {
    expect(parseNumberValue("3,5", ".")).toBeNull();
    expect(parseNumberValue("1,234.5", ",")).toBeNull();
  });

  it("reads currency, percent and accounting negatives", () => {
    expect(parseNumberValue("$1,200.50", ".")).toMatchObject({ value: 1200.5, currency: "USD" });
    expect(parseNumberValue("-$5", ".")).toMatchObject({ value: -5, currency: "USD" });
    expect(parseNumberValue("1.200,50 €", ",")).toMatchObject({ value: 1200.5, currency: "EUR" });
    expect(parseNumberValue("45%", ".")).toMatchObject({ value: 45, percent: true });
    expect(parseNumberValue("(1,234)", ".")?.value).toBe(-1234);
  });

  it("flags leading zeros and long whole-number runs", () => {
    expect(parseNumberValue("00123", ".")?.leadingZero).toBe(true);
    expect(parseNumberValue("0.5", ".")?.leadingZero).toBe(false);
    expect(parseNumberValue("12345678901234567", ".")?.wholeDigits).toBe(17);
  });

  it("does not count a float export's long fraction as a long run", () => {
    expect(parseNumberValue("0.3333333333333333", ".")).toMatchObject({
      value: 0.3333333333333333,
      wholeDigits: 1,
    });
    expect(parseNumberValue("0,6666666666666666", ",")).toMatchObject({
      value: 0.6666666666666666,
      wholeDigits: 1,
    });
  });

  it("rejects text, phone numbers and dates", () => {
    expect(parseNumberValue("abc", ".")).toBeNull();
    expect(parseNumberValue("+1 555 123 4567", ".")).toBeNull();
    expect(parseNumberValue("2026-11-13", ".")).toBeNull();
    expect(parseNumberValue("$", ".")).toBeNull();
  });
});

describe("parseDateValue", () => {
  it("reads ISO dates as UTC midnight", () => {
    expect(parseDateValue("2026-11-13", "MDY")).toEqual({
      iso: "2026-11-13T00:00:00.000Z",
      hasTime: false,
      hour12: false,
    });
    expect(parseDateValue("2026/1/5", "DMY")?.iso).toBe("2026-01-05T00:00:00.000Z");
  });

  it("keeps explicit offsets and reads local date-times", () => {
    expect(parseDateValue("2026-11-13T14:30:00Z", "MDY")?.iso).toBe("2026-11-13T14:30:00.000Z");
    expect(parseDateValue("2026-11-13 14:30 +02:00", "MDY")?.iso).toBe("2026-11-13T12:30:00.000Z");
    const local = parseDateValue("2026-11-13 14:30", "MDY");
    expect(local?.hasTime).toBe(true);
    expect(local?.iso).toBe(new Date(2026, 10, 13, 14, 30).toISOString());
  });

  it("applies the day/month order to numeric dates", () => {
    expect(parseDateValue("03/04/2026", "MDY")?.iso).toBe("2026-03-04T00:00:00.000Z");
    expect(parseDateValue("03/04/2026", "DMY")?.iso).toBe("2026-04-03T00:00:00.000Z");
    expect(parseDateValue("13.11.2026", "DMY")?.iso).toBe("2026-11-13T00:00:00.000Z");
    expect(parseDateValue("13/11/2026", "MDY")).toBeNull();
    expect(parseDateValue("11/13/26", "MDY")?.iso).toBe("2026-11-13T00:00:00.000Z");
  });

  it("reads month names, Notion date-times and ranges", () => {
    expect(parseDateValue("November 13, 2026", "MDY")?.iso).toBe("2026-11-13T00:00:00.000Z");
    expect(parseDateValue("13 Nov 2026", "MDY")?.iso).toBe("2026-11-13T00:00:00.000Z");
    expect(parseDateValue("13-Nov-26", "DMY")?.iso).toBe("2026-11-13T00:00:00.000Z");
    expect(parseDateValue("Fri, Nov 13, 2026", "MDY")?.iso).toBe("2026-11-13T00:00:00.000Z");
    const notion = parseDateValue("November 13, 2026 2:30 PM", "MDY");
    expect(notion).toMatchObject({ hasTime: true, hour12: true });
    expect(notion?.iso).toBe(new Date(2026, 10, 13, 14, 30).toISOString());
    expect(parseDateValue("November 13, 2026 → November 15, 2026", "MDY")?.iso).toBe(
      "2026-11-13T00:00:00.000Z",
    );
    expect(parseDateValue("11/13/2026 2:30pm", "MDY")?.iso).toBe(
      new Date(2026, 10, 13, 14, 30).toISOString(),
    );
  });

  it("rejects impossible dates and plain text", () => {
    expect(parseDateValue("2026-02-30", "MDY")).toBeNull();
    expect(parseDateValue("2026-13-01", "MDY")).toBeNull();
    expect(parseDateValue("13:61", "MDY")).toBeNull();
    expect(parseDateValue("Smarch 13, 2026", "MDY")).toBeNull();
    expect(parseDateValue("2026", "MDY")).toBeNull();
    expect(parseDateValue("hello", "MDY")).toBeNull();
  });

  it("does not read object property names as months", () => {
    expect(parseDateValue("constructor 13, 2026", "MDY")).toBeNull();
    expect(parseDateValue("13 constructor 2026", "DMY")).toBeNull();
  });
});

describe("text helpers", () => {
  it("truncates without leaving half a surrogate pair", () => {
    expect(truncateText("abc", 5)).toBe("abc");
    expect(truncateText("ab😀", 3)).toBe("ab");
    expect(truncateText("abc😀", 3)).toBe("abc");
  });

  it("strips the apostrophe the export puts before formula characters", () => {
    expect(stripFormulaApostrophe("'=1+1")).toBe("=1+1");
    expect(stripFormulaApostrophe("'-5")).toBe("-5");
    expect(stripFormulaApostrophe("'+44")).toBe("+44");
    expect(stripFormulaApostrophe("'@team")).toBe("@team");
    expect(stripFormulaApostrophe("'tis")).toBe("'tis");
    expect(stripFormulaApostrophe("a'=b")).toBe("a'=b");
  });
});

describe("parseBooleanValue", () => {
  it("accepts only clear words when strict", () => {
    expect(parseBooleanValue("Yes", false)).toBe(true);
    expect(parseBooleanValue("unchecked", false)).toBe(false);
    expect(parseBooleanValue("x", false)).toBeNull();
    expect(parseBooleanValue("1", false)).toBeNull();
  });

  it("also accepts short forms when loose", () => {
    expect(parseBooleanValue("x", true)).toBe(true);
    expect(parseBooleanValue("0", true)).toBe(false);
    expect(parseBooleanValue("maybe", true)).toBeNull();
  });
});

describe("normalizeUrl and normalizeEmail", () => {
  it("adds https to www and bare domains, and rejects other schemes", () => {
    expect(normalizeUrl("https://docmost.com/a?b=1")).toBe("https://docmost.com/a?b=1");
    expect(normalizeUrl("www.docmost.com")).toBe("https://www.docmost.com");
    expect(normalizeUrl("docmost.com/pricing")).toBe("https://docmost.com/pricing");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });

  it("validates emails and strips mailto", () => {
    expect(normalizeEmail("mailto:ada@example.com")).toBe("ada@example.com");
    expect(normalizeEmail("ada@")).toBeNull();
  });
});

describe("list helpers", () => {
  it("splits, trims and de-duplicates case-insensitively", () => {
    expect(splitListValue("Red, blue ,red,, Green", ",")).toEqual(["Red", "blue", "Green"]);
    expect(splitListValue("a; b", ";")).toEqual(["a", "b"]);
  });

  it("strips the export's formula apostrophe from each item", () => {
    expect(splitListValue("'=a; '-b; =a", ";")).toEqual(["=a", "-b"]);
  });

  it("pulls the email out of a name with an address", () => {
    expect(personToken("Ada Lovelace <ada@example.com>")).toBe("ada@example.com");
    expect(personToken(" Ada Lovelace ")).toBe("Ada Lovelace");
  });

  it("recognises null markers", () => {
    expect(isNullMarker(" N/A ")).toBe(true);
    expect(isNullMarker("-")).toBe(true);
    expect(isNullMarker("Nope")).toBe(false);
  });
});

describe("locale hints", () => {
  it("reads day/month order and the decimal separator from the locale", () => {
    expect(localeDateOrder("en-US")).toBe("MDY");
    expect(localeDateOrder("en-GB")).toBe("DMY");
    expect(localeDateOrder("de-DE")).toBe("DMY");
    expect(localeDecimalSeparator("en-US")).toBe(".");
    expect(localeDecimalSeparator("de-DE")).toBe(",");
  });
});
