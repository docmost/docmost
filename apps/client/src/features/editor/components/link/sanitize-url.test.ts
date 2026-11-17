import { sanitizeUrl } from "@docmost/editor-ext";
import { describe, expect, it } from "vitest";

describe("sanitizeUrl", () => {
  it.each([
    "mailto:support@example.com?subject=Help%20request&body=Line%201%0ALine%202",
    "mailto:support@example.com?subject=Q%26A&body=Tom%20%26%20Jerry",
    "https://example.com/search?q=a%26b&page=2",
    "https://example.com/files/a%2Fb",
    "https://example.com/?tag=%23urgent",
    "https://example.com/?q=100%2525",
    "/api/files/019a3b4c/Q%26A%20%231.pdf",
  ])("keeps %j as given", (url) => {
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeUrl("  https://example.com/a%26b \n")).toBe(
      "https://example.com/a%26b",
    );
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " \tjavascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "javascript://%0Aalert(1)",
    "&#106;avascript:alert(1)",
    "javascript&colon;alert(1)",
    "java&Tab;script:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ])("returns an empty string for %j", (url) => {
    expect(sanitizeUrl(url)).toBe("");
  });
});
