import { describe, expect, it } from "vitest";
import { convertCsvText, parseCsvRows, profileCsvText } from "./csv-import-parse";
import type { CsvConvertColumn } from "./csv-import.types";

const hints = { dateOrder: "MDY", decimalSeparator: ".", listSeparator: "," } as const;

describe("parseCsvRows", () => {
  it("detects semicolons and tabs and skips blank lines", () => {
    const rows: string[][] = [];
    expect(parseCsvRows("a;b\r\n1;2\r\n;\r\n\r\n3;4", null, (row) => rows.push(row))).toBe(";");
    expect(rows).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
    expect(parseCsvRows("a\tb\n1\t2", null, () => undefined)).toBe("\t");
  });

  it("keeps quoted delimiters and newlines inside a value", () => {
    const rows: string[][] = [];
    parseCsvRows('name,notes\n"Doe, Jane","line one\nline two"', ",", (row) => rows.push(row));
    expect(rows[1]).toEqual(["Doe, Jane", "line one\nline two"]);
  });
});

describe("profileCsvText", () => {
  it("reads headers, counts rows and keeps a preview", () => {
    const text = "Name,Points\nAda,3\nGrace,5\n";
    const result = profileCsvText(text, { delimiter: null, hasHeader: true }, "en-US");
    expect(result.headers).toEqual(["Name", "Points"]);
    expect(result.rowCount).toBe(2);
    expect(result.previewRows).toEqual([["Ada", "3"], ["Grace", "5"]]);
    expect(result.profiles[1].suggestion.type).toBe("number");
  });

  it("uses the widest row for column count when there is no header", () => {
    const result = profileCsvText("a,b\nc,d,e\n", { delimiter: ",", hasHeader: false }, "en-US");
    expect(result.headers).toEqual(["", "", ""]);
    expect(result.rowCount).toBe(2);
  });

  it("ignores values beyond the header width", () => {
    const result = profileCsvText("A\n1,extra\n", { delimiter: ",", hasHeader: true }, "en-US");
    expect(result.headers).toEqual(["A"]);
    expect(result.profiles).toHaveLength(1);
  });

  it("drops the apostrophe spreadsheets put before formula-like headers", () => {
    const result = profileCsvText("'=Total,'tis\n1,2\n", { delimiter: ",", hasHeader: true }, "en-US");
    expect(result.headers).toEqual(["=Total", "'tis"]);
  });
});

describe("convertCsvText", () => {
  const columns: CsvConvertColumn[] = [
    { index: 0, type: "text", hints },
    { index: 2, type: "number", hints },
  ];

  it("writes one JSON array per row in column order", () => {
    const text = "Name,Skip,Points\nAda,x,3\nGrace,y,abc\n";
    const result = convertCsvText(text, { delimiter: ",", hasHeader: true }, columns);
    expect(result.parts.join("")).toBe('["Ada",3]\n["Grace",null]\n');
    expect(result.rowCount).toBe(2);
    expect(result.skippedValues).toBe(1);
  });

  it("leaves out rows whose chosen columns are empty", () => {
    const text = "Name,Skip,Points\nAda,x,3\n,only here,\n";
    const result = convertCsvText(text, { delimiter: ",", hasHeader: true }, columns);
    expect(result.rowCount).toBe(1);
  });

  it("treats the first row as data without a header", () => {
    const result = convertCsvText("Ada,x,3\n", { delimiter: ",", hasHeader: false }, columns);
    expect(result.parts.join("")).toBe('["Ada",3]\n');
  });

  it("escapes line and paragraph separators so each row stays on one line", () => {
    const result = convertCsvText("Name\na\u2028b\u2029c\n", { delimiter: ",", hasHeader: true }, [
      { index: 0, type: "text", hints },
    ]);
    const output = result.parts.join("");
    expect(output).toBe('["a\\u2028b\\u2029c"]\n');
    expect(JSON.parse(output)).toEqual(["a\u2028b\u2029c"]);
  });

  it("counts multi-select items left out of a cell", () => {
    const text = `Tags\n"ok, ${"x".repeat(256)}"\n`;
    const result = convertCsvText(text, { delimiter: ",", hasHeader: true }, [
      { index: 0, type: "multiSelect", hints },
    ]);
    expect(result.parts.join("")).toBe('[["ok"]]\n');
    expect(result.skippedValues).toBe(1);
  });

  it("does not count unreadable values of rows it leaves out", () => {
    const text = "Name,Skip,Points\n,x,abc\nAda,y,abc\n";
    const result = convertCsvText(text, { delimiter: ",", hasHeader: true }, columns);
    expect(result.rowCount).toBe(1);
    expect(result.skippedValues).toBe(1);
  });
});
