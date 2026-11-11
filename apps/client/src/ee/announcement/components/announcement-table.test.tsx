import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementTable } from "./announcement-table";
import type {
  AnnouncementColor,
  AnnouncementType,
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
  title: "Maintenance window",
  type: "warning",
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
  onUnarchive: vi.fn(),
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
        emptyMessage={props.emptyMessage ?? "No active announcements"}
        {...actions}
      />
    </MantineProvider>,
  );
  return actions;
}

function openActions() {
  fireEvent.click(
    screen.getByRole("button", { name: "Actions for Maintenance window" }),
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
    ["archived", ["Edit", "Unarchive", "Delete"]],
  ] as const)("offers the actions an %s announcement allows", (status, labels) => {
    renderTable([announcement(status)]);
    openActions();
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(labels);
  });

  it("offers Unarchive for an archived announcement whose end is still ahead", () => {
    renderTable([
      announcement("archived", {
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ]);
    openActions();
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Edit", "Unarchive", "Delete"]);
  });

  it("hides Unarchive for an archived announcement whose end has passed", () => {
    renderTable([
      announcement("archived", { endsAt: "2020-01-01T18:00:00.000Z" }),
    ]);
    openActions();
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Edit", "Delete"]);
  });

  it.each([
    ["Edit", "onEdit"],
    ["Unarchive", "onUnarchive"],
    ["Delete", "onDelete"],
  ] as const)("passes the announcement to %s", (label, handler) => {
    const archived = announcement("archived");
    const actions = renderTable([archived]);
    openActions();
    fireEvent.click(screen.getByRole("menuitem", { name: label }));
    expect(actions[handler]).toHaveBeenCalledWith(archived);
  });

  it.each([
    ["active", ["Archive"]],
    ["scheduled", ["Archive"]],
    ["archived", ["Delete"]],
  ] as const)(
    "offers only Archive or Delete for an %s announcement without edit and unarchive",
    (status, labels) => {
      const { onArchive, onDelete } = handlers();
      render(
        <MantineProvider env="test">
          <AnnouncementTable
            announcements={[
              announcement(status, {
                endsAt: new Date(Date.now() + 86_400_000).toISOString(),
              }),
            ]}
            isLoading={false}
            emptyMessage="No active announcements"
            onArchive={onArchive}
            onDelete={onDelete}
          />
        </MantineProvider>,
      );
      openActions();
      expect(
        screen.getAllByRole("menuitem").map((item) => item.textContent),
      ).toEqual(labels);
    },
  );

  it("shows the type, audience, schedule and status", () => {
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

  it("shows a type, color or status it does not know without failing", () => {
    renderTable([
      announcement("active", {
        type: "sparkle" as AnnouncementType,
        color: "teal" as AnnouncementColor,
        status: "paused" as AnnouncementStatus,
      }),
    ]);
    const [, row] = screen.getAllByRole("row");

    expect(within(row).getByText("sparkle")).toBeTruthy();
    expect(within(row).getByText("paused")).toBeTruthy();
    expect(within(row).getByRole("img", { name: "Gray" })).toBeTruthy();
  });

  it("shows the title with a preview of the message beneath", () => {
    renderTable([announcement("active")]);
    const [, row] = screen.getAllByRole("row");

    expect(within(row).getByText("Maintenance window")).toBeTruthy();
    expect(within(row).getByText("Planned maintenance")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Title" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Message" })).toBeNull();
  });

  it("shows three skeleton rows while loading", () => {
    renderTable([], { isLoading: true });
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("No active announcements")).toBeNull();
  });

  it("shows the empty message when there is nothing to list", () => {
    renderTable([], { emptyMessage: "No archived announcements" });
    expect(screen.getByText("No archived announcements")).toBeTruthy();
  });
});
