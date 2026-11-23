import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementConflictSummary } from "./announcement-conflict-summary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));

const format = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const announcements = [
  { id: "b", title: "Acceptable use policy" },
  { id: "c", title: "Holiday hours" },
];

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AnnouncementConflictSummary", () => {
  it("lists the clashing announcements with the time they overlap", () => {
    render(
      <MantineProvider env="test">
        <AnnouncementConflictSummary
          conflict={{
            from: "2026-11-05T09:00:00.000Z",
            to: "2026-11-05T18:00:00.000Z",
            announcements,
          }}
        />
      </MantineProvider>,
    );

    expect(
      screen.getByText(
        `These already show between ${format("2026-11-05T09:00:00.000Z")} and ${format("2026-11-05T18:00:00.000Z")}:`,
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Acceptable use policy", "Holiday hours"]);
  });

  it("says when the clash has no end", () => {
    render(
      <MantineProvider env="test">
        <AnnouncementConflictSummary
          conflict={{
            from: "2026-11-05T09:00:00.000Z",
            to: null,
            announcements: announcements.slice(0, 1),
          }}
        />
      </MantineProvider>,
    );

    expect(
      screen.getByText(
        `These already show from ${format("2026-11-05T09:00:00.000Z")} with no end:`,
      ),
    ).toBeTruthy();
  });
});
