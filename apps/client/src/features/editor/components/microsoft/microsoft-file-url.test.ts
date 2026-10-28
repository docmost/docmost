import { sanitizeMicrosoftFileItems } from "@docmost/editor-ext";
import { describe, expect, it } from "vitest";

const PLAN_URL = "https://contoso.sharepoint.com/sites/M/Shared%20Documents/Plan.docx";
const ENCODED_URL =
  "https://contoso.sharepoint.com/sites/M/Shared%20Documents/C%23%20notes.docx";

function fileItem(itemId: string, webUrl: string) {
  return { driveId: "b!d", itemId, webUrl, name: `${itemId}.docx` };
}

describe("sanitizeMicrosoftFileItems", () => {
  it("keeps percent-encoded characters in the file url", () => {
    const item = fileItem("notes", ENCODED_URL);

    expect(sanitizeMicrosoftFileItems([item])).toEqual([item]);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "\n\tjavascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://contoso.sharepoint.com/sites/M/Plan.docx",
  ])("drops an item whose url is %j", (webUrl) => {
    expect(sanitizeMicrosoftFileItems([fileItem("bad", webUrl)])).toEqual([]);
  });

  it("keeps the ids and name of each valid https item", () => {
    const plan = fileItem("plan", PLAN_URL);
    const budget = {
      driveId: "b!other",
      itemId: "budget",
      webUrl: "https://contoso-my.sharepoint.com/personal/a/Documents/Budget.xlsx",
      name: "Budget.xlsx",
    };

    expect(
      sanitizeMicrosoftFileItems([plan, fileItem("bad", "javascript:alert(1)"), budget]),
    ).toEqual([plan, budget]);
  });
});
