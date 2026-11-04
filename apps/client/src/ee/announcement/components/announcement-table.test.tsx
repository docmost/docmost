import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementTable } from "./announcement-table";
import type {
  AnnouncementColor,
  AnnouncementKind,
  AnnouncementStatus,
  IAnnouncement,
} from "../types/announcement.types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));

const announcement = (
  status: AnnouncementStatus,
  overrides: Partial<IAnnouncement> = {},
): IAnnouncement => ({
  id: `id-${status}`,
  kind: "warning",
  color: "yellow",
  content: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Planned maintenance" }] },
    ],
  },
  isDismissible: false,
  audience: "everyone",
  startsAt: "2026-11-04T09:00:00.000Z",
  endsAt: null,
  archivedAt: status === "archived" ? "2026-11-04T10:00:00.000Z" : null,
  status,
  createdAt: "2026-11-03T09:00:00.000Z",
  updatedAt: "2026-11-03T09:00:00.000Z",
  ...overrides,
});

const handlers = () => ({
  onEdit: vi.fn(),
  onArchive: vi.fn(),
  onRestore: vi.fn(),
  onDelete: vi.fn(),
});

function renderTable(
  announcements: IAnnouncement[],
  props: Partial<{ isLoading: boolean; emptyMessage: string }> = {},
) {
  const actions = handlers();
  render(
    <MantineProvider env="test">
      <AnnouncementTable
        announcements={announcements}
        isLoading={props.isLoading ?? false}
        emptyMessage={props.emptyMessage ?? "No current announcements"}
        {...actions}
      />
    </MantineProvider>,
  );
  return actions;
}

function openActions() {
  fireEvent.click(
    screen.getByRole("button", { name: "Actions for Planned maintenance" }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AnnouncementTable", () => {
  it.each([
    ["active", ["Edit", "Archive"]],
    ["scheduled", ["Edit", "Archive"]],
    ["ended", ["Edit", "Delete"]],
    ["archived", ["Edit", "Restore", "Delete"]],
  ] as const)("offers the actions an %s announcement allows", (status, labels) => {
    renderTable([announcement(status)]);
    openActions();
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(labels);
  });

  it.each([
    ["Edit", "onEdit"],
    ["Restore", "onRestore"],
    ["Delete", "onDelete"],
  ] as const)("passes the announcement to %s", (label, handler) => {
    const archived = announcement("archived");
    const actions = renderTable([archived]);
    openActions();
    fireEvent.click(screen.getByRole("menuitem", { name: label }));
    expect(actions[handler]).toHaveBeenCalledWith(archived);
  });

  it("shows the kind, audience, schedule and status", () => {
    renderTable([
      announcement("scheduled", { endsAt: "2026-11-05T18:00:00.000Z" }),
      announcement("active", { id: "a2", audience: "members" }),
    ]);
    const [, scheduled, active] = screen.getAllByRole("row");

    expect(within(scheduled).getByText("Warning")).toBeTruthy();
    expect(within(scheduled).getByText("Everyone")).toBeTruthy();
    expect(within(scheduled).getByText("Scheduled")).toBeTruthy();
    expect(
      within(scheduled).getByText(
        new Date("2026-11-05T18:00:00.000Z").toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      ),
    ).toBeTruthy();
    expect(within(active).getByText("Logged-in users")).toBeTruthy();
    expect(within(active).getByText("No end")).toBeTruthy();
    expect(within(active).getByText("Active")).toBeTruthy();
  });

  it("shows a kind, color or status it does not know without failing", () => {
    renderTable([
      announcement("active", {
        kind: "sparkle" as AnnouncementKind,
        color: "teal" as AnnouncementColor,
        status: "paused" as AnnouncementStatus,
      }),
    ]);
    const [, row] = screen.getAllByRole("row");

    expect(within(row).getByText("sparkle")).toBeTruthy();
    expect(within(row).getByText("paused")).toBeTruthy();
    expect(within(row).getByRole("img", { name: "Gray" })).toBeTruthy();
  });

  it("shows three skeleton rows while loading", () => {
    renderTable([], { isLoading: true });
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("No current announcements")).toBeNull();
  });

  it("shows the empty message when there is nothing to list", () => {
    renderTable([], { emptyMessage: "No archived announcements" });
    expect(screen.getByText("No archived announcements")).toBeTruthy();
  });
});
