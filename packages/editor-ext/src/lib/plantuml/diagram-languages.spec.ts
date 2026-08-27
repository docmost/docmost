import { describe, expect, it } from "vitest";
import { isDiagramLanguage } from "./diagram-languages";

describe("isDiagramLanguage", () => {
  it("recognises mermaid", () => {
    expect(isDiagramLanguage("mermaid")).toBe(true);
  });

  it("recognises plantuml", () => {
    expect(isDiagramLanguage("plantuml")).toBe(true);
  });

  it("rejects ordinary code languages", () => {
    expect(isDiagramLanguage("typescript")).toBe(false);
    expect(isDiagramLanguage("python")).toBe(false);
  });

  it("rejects null, undefined and empty values", () => {
    expect(isDiagramLanguage(null)).toBe(false);
    expect(isDiagramLanguage(undefined)).toBe(false);
    expect(isDiagramLanguage("")).toBe(false);
  });
});
