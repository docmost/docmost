import { describe, expect, it, vi } from "vitest";
import type { IBaseProperty, PublicFormField } from "@/ee/base/types/base.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

import { isFormFieldProperty, toFormField, validateFormAnswers } from "./form-definition";

const question = (includeTime: boolean, required = false) =>
  ({ propertyId: "when", type: "date", label: "When", description: null, required, defaultValue: null, includeTime }) as PublicFormField;
const errorFor = (field: PublicFormField, value: unknown) => validateFormAnswers([field], { when: value }).when;
const dateProperty = (typeOptions: object, extra: object = {}) =>
  ({ id: "when", pageId: "base-1", name: "When", type: "date", position: "a", typeOptions, isPrimary: false, ...extra }) as unknown as IBaseProperty;

describe("date answers", () => {
  it.each([
    [false, { start: "2026-11-12" }, undefined],
    [false, { start: "2026-11-12T15:00:00.000Z" }, "invalid"],
    [false, { start: "2026-02-30" }, "invalid"],
    [false, { start: "2026-11-12", end: "2026-11-14" }, "invalid"],
    [false, { start: "2026-11-12", end: "2026-11-12" }, "invalid"],
    [false, { start: "2026-11-12", note: "x" }, "invalid"],
    [false, "November 12", "invalid"],
    [true, { start: "2026-11-12T15:00:00.000Z" }, undefined],
    [true, { start: "2026-11-12" }, "invalid"],
    [true, { start: "2026-11-12T10:00:00" }, "invalid"],
    [true, { start: "2026-11-12T15:00:00.000Z", end: "2026-11-12T16:00:00.000Z" }, "invalid"],
  ])("with a time %s, the answer %j is %s", (includeTime, value, error) => {
    expect(errorFor(question(includeTime), value)).toBe(error);
  });

  it("asks for an answer to a required date question", () => {
    expect(errorFor(question(true, true), null)).toBe("required");
  });
});

describe("date questions", () => {
  it("carry the property's kind and formats, and no default", () => {
    const options = { includeTime: true, dateFormat: "dayMonthYear", timeFormat: "24h", defaultValue: "2026-01-01" };
    expect(toFormField(dateProperty(options), { propertyId: "when" })).toMatchObject({
      type: "date",
      includeTime: true,
      dateFormat: "dayMonthYear",
      timeFormat: "24h",
      defaultValue: null,
    });
    const plain = toFormField(dateProperty({}), { propertyId: "when" });
    expect(plain.includeTime).toBe(false);
    expect(plain.dateFormat).toBeUndefined();
    expect(plain.timeFormat).toBeUndefined();
  });

  it("are left out while their property is being converted", () => {
    expect(isFormFieldProperty(dateProperty({}))).toBe(true);
    expect(isFormFieldProperty(dateProperty({}, { pendingType: "text" }))).toBe(false);
    expect(isFormFieldProperty(dateProperty({ includeTime: true }, { pendingTypeOptions: { includeTime: false } }))).toBe(false);
  });
});
