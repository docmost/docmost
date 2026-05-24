import {
  conversionWarning,
  NON_USER_TARGET_TYPES,
} from "../conversion-warning";

describe("conversionWarning", () => {
  it("returns the choice-name copy for select → text", () => {
    expect(conversionWarning("select", "text")).toBe(
      "Cells will be replaced with the option name.",
    );
  });

  it("returns the same copy for status → text", () => {
    expect(conversionWarning("status", "text")).toBe(
      "Cells will be replaced with the option name.",
    );
  });

  it("returns comma-list copy for multiSelect → text", () => {
    expect(conversionWarning("multiSelect", "text")).toBe(
      "Cells will be replaced with a comma-separated list of option names.",
    );
  });

  it("returns person-name copy for person → text", () => {
    expect(conversionWarning("person", "text")).toBe(
      "Cells will be replaced with the person's name.",
    );
  });

  it("returns file-name list copy for file → text", () => {
    expect(conversionWarning("file", "text")).toBe(
      "Cells will be replaced with a comma-separated list of file names.",
    );
  });

  it("returns page-title copy for page → text", () => {
    expect(conversionWarning("page", "text")).toBe(
      "Cells will be replaced with the page title.",
    );
  });

  it("returns first-item-kept copy for multiSelect → select", () => {
    expect(conversionWarning("multiSelect", "select")).toBe(
      "Only the first selected item per row will be kept; the rest will be discarded.",
    );
  });

  it("returns single-item-list copy for select → multiSelect", () => {
    expect(conversionWarning("select", "multiSelect")).toBe(
      "Existing values become single-item lists. No data is lost.",
    );
  });

  it("returns page-cleared copy when target is page from non-page", () => {
    expect(conversionWarning("text", "page")).toBe(
      "Cells that aren't already a page reference will be cleared.",
    );
    expect(conversionWarning("number", "page")).toBe(
      "Cells that aren't already a page reference will be cleared.",
    );
  });

  it("returns number-parse-cleared copy when target is number from non-numeric", () => {
    expect(conversionWarning("select", "number")).toBe(
      "Cells that can't be parsed as a number will be cleared.",
    );
  });

  it("returns date-parse-cleared copy when target is date", () => {
    expect(conversionWarning("text", "date")).toBe(
      "Cells that can't be parsed as a date will be cleared.",
    );
  });

  it("returns checkbox-coercion copy when target is checkbox", () => {
    expect(conversionWarning("text", "checkbox")).toBe(
      "Cells will be coerced (yes/true/1 become checked; everything else becomes unchecked or cleared).",
    );
  });

  it("returns url-cleared copy when target is url", () => {
    expect(conversionWarning("text", "url")).toBe(
      "Cells that aren't a valid URL will be cleared.",
    );
  });

  it("returns email-cleared copy when target is email", () => {
    expect(conversionWarning("text", "email")).toBe(
      "Cells that aren't a valid email address will be cleared.",
    );
  });

  it("returns the default safe copy for number → text", () => {
    expect(conversionWarning("number", "text")).toBe(
      "Cells will be reinterpreted under the new type.",
    );
  });

  describe("NON_USER_TARGET_TYPES", () => {
    it("contains exactly the 4 non-user types", () => {
      expect(Array.from(NON_USER_TARGET_TYPES).sort()).toEqual([
        "createdAt",
        "formula",
        "lastEditedAt",
        "lastEditedBy",
      ]);
    });
  });
});
