import { describe, expect, it } from "vitest";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { formatFileSize, legalHoldFormSchema } from "./legal-hold.utils";

const validate = zod4Resolver(legalHoldFormSchema);

const values = (over: Record<string, unknown> = {}) => ({
  name: "Contract dispute 2026",
  description: "",
  userIds: ["u1"],
  spaceIds: [],
  ...over,
});

describe("legalHoldFormSchema", () => {
  it("rejects an empty name", () => {
    expect(validate(values({ name: "" }))).toEqual({
      name: "Name is required",
    });
  });

  it("rejects a name made of spaces", () => {
    expect(validate(values({ name: "   " }))).toEqual({
      name: "Name is required",
    });
  });

  it("rejects a hold without custodians or spaces on the custodians field", () => {
    expect(validate(values({ userIds: [], spaceIds: [] }))).toEqual({
      userIds: "Add at least one custodian or space",
    });
  });

  it("reports the name and the scope together", () => {
    expect(validate(values({ name: "", userIds: [] }))).toEqual({
      name: "Name is required",
      userIds: "Add at least one custodian or space",
    });
  });

  it("accepts one space and no custodians", () => {
    expect(validate(values({ userIds: [], spaceIds: ["s1"] }))).toEqual({});
  });

  it("rejects a name over 100 characters and a description over 2000", () => {
    const errors = validate(
      values({ name: "a".repeat(101), description: "b".repeat(2001) }),
    );
    expect(Object.keys(errors).sort()).toEqual(["description", "name"]);
    expect(validate(values({ name: "a".repeat(100), description: "b".repeat(2000) }))).toEqual({});
  });
});

describe("formatFileSize", () => {
  it("formats kilobytes with one decimal", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("returns null without a size", () => {
    expect(formatFileSize(null)).toBeNull();
  });
});
