import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissAnnouncement,
  fromPickerValue,
  getAnnouncementPlainText,
  getAnnouncementPreview,
  isAnnouncementDismissed,
  isAnnouncementVisibleAt,
  isSafeAnnouncementHref,
  toPickerValue,
} from "./announcement.utils";
import { ANNOUNCEMENT_COLOR_STYLES } from "./announcement.constants";
import type {
  IAnnouncementBanner,
  IAnnouncementContent,
} from "./types/announcement.types";

const content = (text: string): IAnnouncementContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const banner = (over: Partial<IAnnouncementBanner> = {}): IAnnouncementBanner => ({
  id: "a1",
  type: "info",
  color: "blue",
  content: content("Hi"),
  isDismissible: true,
  startsAt: "2026-11-04T09:00:00.000Z",
  endsAt: null,
  ...over,
});

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(background: string, text: string): number {
  const [lighter, darker] = [background, text]
    .map(relativeLuminance)
    .sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("isAnnouncementVisibleAt", () => {
  it("hides at the end instant and shows at the start instant", () => {
    const a = banner({ endsAt: "2026-11-04T10:00:00.000Z" });
    expect(isAnnouncementVisibleAt(a, Date.parse("2026-11-04T08:59:59.999Z"))).toBe(false);
    expect(isAnnouncementVisibleAt(a, Date.parse("2026-11-04T09:00:00.000Z"))).toBe(true);
    expect(isAnnouncementVisibleAt(a, Date.parse("2026-11-04T10:00:00.000Z"))).toBe(false);
  });

  it("stays visible without an end", () => {
    expect(isAnnouncementVisibleAt(banner(), Date.parse("2031-01-01T00:00:00.000Z"))).toBe(true);
  });
});

describe("dismissal", () => {
  it("remembers a dismissal until the content changes", () => {
    dismissAnnouncement(banner());
    expect(isAnnouncementDismissed(banner())).toBe(true);
    expect(isAnnouncementDismissed(banner({ content: content("Hi there") }))).toBe(false);
    expect(isAnnouncementDismissed(banner({ color: "red" }))).toBe(false);
    expect(isAnnouncementDismissed(banner({ endsAt: "2026-12-01T00:00:00.000Z" }))).toBe(true);
  });

  it("shows the announcement again when only its type changes", () => {
    dismissAnnouncement(banner({ id: "k1" }));
    expect(isAnnouncementDismissed(banner({ id: "k1", type: "warning" }))).toBe(false);
  });

  it("only hides the announcement that was dismissed", () => {
    dismissAnnouncement(banner({ id: "d1" }));
    expect(isAnnouncementDismissed(banner({ id: "d2" }))).toBe(false);
  });

  it("keeps a dismissal for the session when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => dismissAnnouncement(banner({ id: "s1" }))).not.toThrow();
    expect(isAnnouncementDismissed(banner({ id: "s1" }))).toBe(true);
    vi.restoreAllMocks();
  });

  it("does not throw when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(isAnnouncementDismissed(banner({ id: "never-dismissed" }))).toBe(false);
  });

  it("persists a dismissal across page loads", async () => {
    dismissAnnouncement(banner({ id: "p1" }));
    expect(localStorage.getItem("docmost.announcement.dismissed.p1")).toEqual(expect.any(String));

    vi.resetModules();
    const reloaded = await import("./announcement.utils");
    expect(reloaded.isAnnouncementDismissed(banner({ id: "p1" }))).toBe(true);
    expect(reloaded.isAnnouncementDismissed(banner({ id: "p1", content: content("Changed") }))).toBe(false);
  });
});

describe("picker values", () => {
  it("round-trips picker values in local time", () => {
    expect(fromPickerValue("2026-11-05 09:30:00")).toBe(new Date(2026, 10, 5, 9, 30, 0).toISOString());
    expect(toPickerValue(new Date(2026, 10, 5, 9, 30, 0).toISOString())).toBe("2026-11-05 09:30:00");
  });

  describe("in a zone ahead of UTC", () => {
    beforeEach(() => vi.stubEnv("TZ", "Asia/Kolkata"));
    afterEach(() => vi.unstubAllEnvs());

    it("reads the picked time as local time, not UTC", () => {
      expect(fromPickerValue("2026-11-05 09:30:00")).toBe("2026-11-05T04:00:00.000Z");
      expect(toPickerValue("2026-11-05T04:00:00.000Z")).toBe("2026-11-05 09:30:00");
    });
  });
});

describe("isSafeAnnouncementHref", () => {
  it.each(["https://docmost.com", "mailto:it@company.test", "/s/general/p/abc"])("allows %s", (h) => expect(isSafeAnnouncementHref(h)).toBe(true));
  it.each(["javascript:alert(1)", "//evil.test", "/\\evil.test", "data:text/html,x"])("rejects %s", (h) => expect(isSafeAnnouncementHref(h)).toBe(false));

  it.each(["http://intranet.test/a?b=c", " https://docmost.com "])("also allows %j", (h) => expect(isSafeAnnouncementHref(h)).toBe(true));
  it.each([
    "JaVaScRiPt:alert(1)",
    "ftp://files.test",
    "",
    "relative/path",
    "/\t/evil.test",
    "/\n/evil.test",
    "https://docmost.com/\u0000",
    "https://docmost.com/\ud800",
  ])("also rejects %j", (h) => expect(isSafeAnnouncementHref(h)).toBe(false));

  it("rejects a missing href", () => {
    expect(isSafeAnnouncementHref(undefined as unknown as string)).toBe(false);
  });
});

describe("getAnnouncementPlainText", () => {
  it("joins the text nodes and ignores marks", () => {
    const formatted: IAnnouncementContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Read " },
            { type: "text", text: "this", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    expect(getAnnouncementPlainText(formatted)).toBe("Read this");
  });

  it("is empty for an empty paragraph", () => {
    const emptyDoc = { type: "doc", content: [{ type: "paragraph" }] } as unknown as IAnnouncementContent;
    expect(getAnnouncementPlainText(emptyDoc)).toBe("");
  });
});

describe("getAnnouncementPreview", () => {
  it("keeps a message of up to 80 characters whole", () => {
    const text = "a".repeat(80);
    expect(getAnnouncementPreview(content(text))).toBe(text);
  });

  it("cuts a longer message to 79 characters and an ellipsis", () => {
    expect(getAnnouncementPreview(content("a".repeat(81)))).toBe(`${"a".repeat(79)}…`);
  });

  it("collapses whitespace and counts an emoji as one character", () => {
    const text = `  Big   news ${"🎉".repeat(80)}`;
    expect(getAnnouncementPreview(content(text))).toBe(`Big news ${"🎉".repeat(70)}…`);
  });
});

describe("presets", () => {
  it.each(Object.entries(ANNOUNCEMENT_COLOR_STYLES))("%s meets WCAG AA contrast", (_key, { background, text }) => {
    expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(4.5);
  });
});
