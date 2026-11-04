import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStartLanguage, rememberWorkspaceLanguage } from "./locale";

function storeMember(locale: string) {
  localStorage.setItem(
    "currentUser",
    JSON.stringify({ user: { locale }, workspace: {} }),
  );
}

describe("getStartLanguage", () => {
  beforeEach(() => {
    // the built index.html
    document.documentElement.lang = "en";
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts in the language of the member stored in this browser", () => {
    storeMember("ja-JP");
    document.documentElement.lang = "de-DE";
    rememberWorkspaceLanguage("fr-FR");

    expect(getStartLanguage()).toBe("ja-JP");
  });

  it("reads a member's legacy en locale as en-US", () => {
    storeMember("en");
    document.documentElement.lang = "de-DE";

    expect(getStartLanguage()).toBe("en-US");
  });

  it("prefers the language the server put in the page over the remembered one", () => {
    document.documentElement.lang = "de-DE";
    rememberWorkspaceLanguage("fr-FR");

    expect(getStartLanguage()).toBe("de-DE");
  });

  it("falls back to the workspace language remembered from an earlier visit", () => {
    rememberWorkspaceLanguage("fr-FR");

    expect(getStartLanguage()).toBe("fr-FR");
  });

  it("has no start language on a first visit", () => {
    expect(getStartLanguage()).toBeUndefined();
  });

  it("skips a stored member it cannot parse", () => {
    localStorage.setItem("currentUser", "{not json");
    rememberWorkspaceLanguage("fr-FR");

    expect(getStartLanguage()).toBe("fr-FR");
  });

  it("ignores a remembered language that is not shipped", () => {
    rememberWorkspaceLanguage("pl-PL");

    expect(getStartLanguage()).toBeUndefined();
  });

  it("still starts when the browser blocks storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    document.documentElement.lang = "de-DE";

    expect(getStartLanguage()).toBe("de-DE");
  });
});
