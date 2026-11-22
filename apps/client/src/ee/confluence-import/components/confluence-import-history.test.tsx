import { MantineProvider } from "@mantine/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useConfluenceImportsQuery } from "../queries/confluence-import-queries";
import type { ConfluenceImportHistoryItem } from "../types/confluence-import.types";
import ConfluenceImportHistory from "./confluence-import-history";

vi.mock("../queries/confluence-import-queries");
vi.mock("@/lib/time", () => ({
  formattedDate: (date: Date) => date.toISOString(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function historyItem(
  overrides: Partial<ConfluenceImportHistoryItem> = {},
): ConfluenceImportHistoryItem {
  return {
    fileTaskId: "job",
    siteUrl: "https://wiki.example",
    status: "processing",
    cancelled: false,
    currentPhase: "history",
    spaceKeys: [],
    errorMessage: null,
    createdAt: "2026-01-01T12:00:00Z",
    updatedAt: "2026-01-01T12:00:00Z",
    creatorId: null,
    creatorName: null,
    creatorAvatarUrl: null,
    totalSpaces: 1,
    importedSpaces: 1,
    totalPages: 4,
    importedPages: 4,
    totalTemplates: 0,
    importedTemplates: 0,
    totalUsers: 0,
    importedUsers: 0,
    totalGroups: 0,
    importedGroups: 0,
    totalLabels: 0,
    importedLabels: 0,
    totalAttachments: 0,
    importedAttachments: 0,
    totalRestrictedPages: 0,
    importedRestrictedPages: 0,
    includeBlogPosts: true,
    importedBlogPosts: 2,
    totalBlogPosts: 3,
    includePageHistory: true,
    importedPageRevisions: 0,
    ...overrides,
  };
}

function provide(item: ConfluenceImportHistoryItem) {
  vi.mocked(useConfluenceImportsQuery).mockReturnValue({
    data: { items: [item] },
    isLoading: false,
  } as ReturnType<typeof useConfluenceImportsQuery>);
}

function showDetails() {
  const view = render(<ConfluenceImportHistory />, {
    wrapper: ({ children }) => (
      <MantineProvider env="test">{children}</MantineProvider>
    ),
  });
  fireEvent.click(screen.getByRole("button", { name: /Import details for/ }));
  return view;
}

it("shows a zero user total once discovery has finished", () => {
  provide(historyItem({ currentPhase: "users" }));
  const { rerender } = render(<ConfluenceImportHistory />, {
    wrapper: ({ children }) => (
      <MantineProvider env="test">{children}</MantineProvider>
    ),
  });
  expect(screen.getByText(/0\/\? users/)).toBeDefined();
  provide(historyItem({ currentPhase: "groups" }));
  rerender(<ConfluenceImportHistory />);
  expect(screen.getByText(/0\/0 users/)).toBeDefined();
});

it("updates the recorded counts while import details are open", () => {
  provide(historyItem());
  const { rerender } = showDetails();
  const details = within(screen.getByRole("dialog"));
  expect(details.getByRole("row", { name: /^Pages / }).textContent).toContain(
    "4 / 4",
  );
  expect(
    details.getByRole("row", { name: /Blog posts/ }).textContent,
  ).toContain("2 / 3");
  expect(
    details.getByRole("row", { name: /Page history revisions/ }).textContent,
  ).toContain("0");
  provide(historyItem({ importedPageRevisions: 7, status: "success" }));
  rerender(<ConfluenceImportHistory />);
  expect(
    details.getByRole("row", { name: /Page history revisions/ }).textContent,
  ).toContain("7");
});

it("distinguishes an old unrecorded count from an option left off", () => {
  provide(
    historyItem({
      importedBlogPosts: null,
      totalBlogPosts: null,
      includePageHistory: false,
      importedPageRevisions: null,
    }),
  );
  showDetails();
  const details = within(screen.getByRole("dialog"));
  expect(
    details.getByRole("row", { name: /Blog posts/ }).textContent,
  ).toContain("Not recorded");
  expect(
    details.getByRole("row", { name: /Page history revisions/ }).textContent,
  ).toContain("Not requested");
});
