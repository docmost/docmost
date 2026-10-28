import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { OneDriveIcon, SharePointIcon } from "@/components/icons";
import { microsoftApp, microsoftAppIcon } from "./microsoft-app";

describe("microsoftApp", () => {
  it.each([
    "https://contoso-my.sharepoint.com/personal/ann_contoso_com/Documents/Plan.docx",
    "https://Contoso-MY.SharePoint.com/:w:/g/personal/ann_contoso_com/EQabc",
  ])("names OneDrive for a personal site on the -my host: %s", (url) => {
    expect(microsoftApp(url)).toBe("OneDrive");
  });

  it.each([
    "https://contoso.sharepoint.com/sites/team/Shared%20Documents/Plan.docx",
    "https://contoso.sharepoint.com/sites/team-my/Documents",
    "https://contoso-my.sharepoint.com.example.org/Plan.docx",
    "not a url",
    "",
    undefined,
  ])("names SharePoint for anything else: %s", (url) => {
    expect(microsoftApp(url)).toBe("SharePoint");
  });
});

describe("microsoftAppIcon", () => {
  it("shows each app's own logo", () => {
    expect((microsoftAppIcon("OneDrive", 18) as ReactElement).type).toBe(
      OneDriveIcon,
    );
    expect((microsoftAppIcon("SharePoint", 18) as ReactElement).type).toBe(
      SharePointIcon,
    );
  });
});
