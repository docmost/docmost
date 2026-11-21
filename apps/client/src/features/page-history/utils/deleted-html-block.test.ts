import { describe, expect, it } from "vitest";
import { deletedHtmlBlockDOM } from "./deleted-html-block";

describe("deletedHtmlBlockDOM", () => {
  it("draws a deleted HTML block as an icon with a label", () => {
    const dom = deletedHtmlBlockDOM("HTML block");

    expect(dom.className).toBe("history-diff-html-block");
    expect(dom.textContent).toBe("HTML block");
    const icon = dom.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.querySelectorAll("path")).toHaveLength(2);
    expect(dom.lastElementChild?.tagName).toBe("SPAN");
  });

  it("adds the label as text", () => {
    const dom = deletedHtmlBlockDOM("<b>HTML</b>");

    expect(dom.querySelector("b")).toBeNull();
    expect(dom.textContent).toBe("<b>HTML</b>");
  });
});
