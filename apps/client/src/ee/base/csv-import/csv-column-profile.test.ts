import { describe, expect, it } from "vitest";
import {
  addColumnValue,
  createColumnStats,
  finalizeColumnProfile,
} from "./csv-column-profile";

function profile(values: string[], header = "Column", locale = "en-US") {
  const stats = createColumnStats();
  for (const value of values) addColumnValue(stats, value);
  return finalizeColumnProfile(stats, header, locale);
}

describe("type suggestion", () => {
  it("suggests text for an empty column", () => {
    expect(profile(["", " "]).suggestion.type).toBe("text");
  });

  it("suggests checkbox for yes/no words and ignores null markers", () => {
    expect(profile(["Yes", "No", "yes", "N/A"]).suggestion.type).toBe("checkbox");
    expect(profile(["1", "0", "1"]).suggestion.type).toBe("number");
  });

  it("suggests number with percent and currency formats", () => {
    expect(profile(["1", "2.5", "-3"]).suggestion).toEqual({
      type: "number",
      typeOptions: { separators: "local" },
    });
    expect(profile(["10%", "12.5%"]).suggestion.typeOptions).toMatchObject({ format: "percent" });
    expect(profile(["$1,000", "$25.50"]).suggestion.typeOptions).toMatchObject({
      format: "currency",
      currencyCode: "USD",
    });
  });

  it("keeps codes with leading zeros and long ids as text", () => {
    expect(profile(["02134", "10001", "60601"]).suggestion.type).toBe("text");
    expect(profile(["12345678901234567", "12345678901234568"]).suggestion.type).toBe("text");
    expect(profile(["1234567890123456.5", "1234567890123457.5"]).suggestion.type).toBe("text");
  });

  it("suggests number for fractions written out at full float length", () => {
    expect(
      profile(["0.5", "0.3333333333333333", "0.6666666666666666", "1", "0"]).suggestion.type,
    ).toBe("number");
  });

  it("detects comma decimals from the data", () => {
    const result = profile(["3,5", "1.234,75", "12"], "Amount", "en-US");
    expect(result.hints.decimalSeparator).toBe(",");
    expect(result.suggestion.type).toBe("number");
    expect(result.issues.number).toBe(0);
  });

  it("detects the day/month order from unambiguous values", () => {
    expect(profile(["13/11/2026", "01/02/2026"]).hints.dateOrder).toBe("DMY");
    expect(profile(["11/13/2026", "01/02/2026"]).hints.dateOrder).toBe("MDY");
    expect(profile(["01/02/2026"], "Due", "en-GB").hints.dateOrder).toBe("DMY");
    expect(profile(["01/02/2026"], "Due", "en-US").hints.dateOrder).toBe("MDY");
    expect(profile(["01.02.2026", "03.04.2026"], "Due", "en-US").hints.dateOrder).toBe("DMY");
  });

  it("reads common yes/no words in other languages as checkboxes", () => {
    expect(profile(["ja", "nein", "Ja"]).suggestion.type).toBe("checkbox");
    expect(profile(["Oui", "Non", "oui"]).suggestion.type).toBe("checkbox");
  });

  it("suggests date with time options for Notion date-times", () => {
    const result = profile(["November 13, 2026 2:30 PM", "November 14, 2026 9:00 AM"]);
    expect(result.suggestion).toEqual({
      type: "date",
      typeOptions: { includeTime: true, timeFormat: "12h" },
    });
    expect(profile(["2026-11-13", "2026-11-14"]).suggestion).toEqual({
      type: "date",
      typeOptions: undefined,
    });
  });

  it("reads exported UTC-midnight dates as dates without a time", () => {
    expect(profile(["2026-11-13T00:00:00.000Z", "2026-11-14T00:00:00.000Z"]).suggestion).toEqual({
      type: "date",
      typeOptions: undefined,
    });
    expect(
      profile(["2026-11-13T00:00:00.000Z", "2026-11-14T09:30:00.000Z"]).suggestion.typeOptions,
    ).toEqual({ includeTime: true, timeFormat: "24h" });
  });

  it("suggests email and url", () => {
    expect(profile(["ada@example.com", "bob@example.org"]).suggestion.type).toBe("email");
    expect(profile(["https://docmost.com", "www.example.com"]).suggestion.type).toBe("url");
  });

  it("suggests select for repeated short values and status for a Status header", () => {
    const values = ["Done", "In progress", "Done", "Todo", "done"];
    expect(profile(values).suggestion.type).toBe("select");
    expect(profile(values, "Status").suggestion.type).toBe("status");
    expect(profile(["Ada", "Bob", "Cy"]).suggestion.type).toBe("text");
  });

  it("suggests multi-select for repeated tokens", () => {
    expect(profile(["Bug, UI", "UI", "Bug", "Backend, Bug"]).suggestion.type).toBe("multiSelect");
    expect(profile(["a; b", "b", "a"]).hints.listSeparator).toBe(";");
    expect(profile(["Hello, world", "Goodbye, moon", "Hi, there"]).suggestion.type).toBe("text");
  });

  it("suggests long text for multi-line or very long values", () => {
    expect(profile(["line one\nline two", "short"]).suggestion.type).toBe("longText");
    expect(profile(["x".repeat(1200)]).suggestion.type).toBe("longText");
  });
});

describe("issues", () => {
  it("counts values each target type would leave empty", () => {
    const result = profile(["12", "N/A", "abc", "7"]);
    expect(result.issues.number).toBe(1);
    expect(result.issues.checkbox).toBe(3);
    expect(result.issues.date).toBe(3);
  });

  it("counts values text would shorten", () => {
    expect(profile(["x".repeat(1001), "ok"]).issues.text).toBe(1);
  });

  it("counts distinct list items apart from distinct cells", () => {
    const result = profile(["Bug, UI", "UI, Bug", "Backend", "bug"]);
    expect(result.distinctCount).toBe(4);
    expect(result.distinctTokenCount).toBe(3);
  });
});
