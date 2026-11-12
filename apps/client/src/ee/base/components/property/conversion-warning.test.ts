import { describe, expect, it } from "vitest";
import type { BasePropertyType } from "@/ee/base/types/base.types";
import { conversionWarning, isLossyConversion } from "./conversion-warning";

const TEXT_LIKE: BasePropertyType[] = ["text", "longText", "url", "email"];
const OTHER: BasePropertyType[] = ["number", "checkbox", "select", "person"];

describe("conversionWarning to date", () => {
  it.each(TEXT_LIKE)("says text from %s shows as empty", (from) => {
    expect(conversionWarning(from, "date")).toBe(
      "Cells that can't be read as a date will show as empty.",
    );
  });

  it.each(OTHER)("says cells from %s are cleared", (from) => {
    expect(conversionWarning(from, "date")).toBe(
      "Cells that can't be parsed as a date will be cleared.",
    );
  });

  it.each([...TEXT_LIKE, ...OTHER])("marks %s to date as lossy", (from) => {
    expect(isLossyConversion(from, "date")).toBe(true);
  });
});
