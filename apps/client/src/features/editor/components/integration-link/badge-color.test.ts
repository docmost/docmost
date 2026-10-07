import { describe, expect, it } from "vitest";
import { badgeTextColor, toBadgeColor } from "./badge-color";

describe("toBadgeColor", () => {
  it("passes through palette names with a checked text colour", () => {
    expect(toBadgeColor("violet")).toBe("violet");
    expect(toBadgeColor("green")).toBe("green");
  });

  it("falls back to gray for names outside the checked palette", () => {
    expect(toBadgeColor("purple")).toBe("gray");
    expect(toBadgeColor("rebeccapurple")).toBe("gray");
    expect(toBadgeColor("constructor")).toBe("gray");
  });

  it("maps hex colours onto the checked palette", () => {
    expect(toBadgeColor("#2da44e")).toBe("green");
    expect(badgeTextColor(toBadgeColor("#2da44e"))).toBeDefined();
  });

  it("uses gray when no colour is given", () => {
    expect(toBadgeColor(undefined)).toBe("gray");
  });
});
