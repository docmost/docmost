import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { getDefaultStore } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms";
import { usePageQuery } from "@/features/page/queries/page-query";
import type { IPage, IPageApproval } from "@/features/page/types/page.types";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import type { IPageVerificationInfo } from "@/ee/page-verification/types/page-verification.types";
import { PageVerificationBadge } from "./page-verification-modal";

vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: vi.fn(),
  invalidatePageInfo: vi.fn(),
}));
vi.mock("@/ee/hooks/use-feature", () => ({ useHasFeature: vi.fn() }));
vi.mock("@/ee/hooks/use-upgrade-label", () => ({
  useUpgradeLabel: () => "Upgrade your plan",
}));
vi.mock("@/ee/page-verification/queries/page-verification-query", () => ({
  usePageVerificationInfoQuery: vi.fn(),
}));
vi.mock("@/i18n.ts", () => ({ default: { language: "en-US" } }));
vi.mock("@/hooks/use-time-ago", () => ({ useTimeAgo: () => "3 days ago" }));
vi.mock("@/lib/date-locale", () => ({
  useDateFnsLocale: () => ({}),
  formatLocalized: () => "Oct 12, 2026",
}));
vi.mock("./setup-verification-form", () => ({
  SetupVerificationForm: () => <div data-testid="setup-form" />,
}));
vi.mock("./manage-verification-form", () => ({
  ManageVerificationForm: () => <div data-testid="manage-form" />,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

function renderBadge(
  info: IPageVerificationInfo | undefined,
  approval?: Partial<IPageApproval>,
  readOnly = false,
) {
  vi.mocked(usePageQuery).mockReturnValue({
    data: {
      id: "page-1",
      slugId: "slug-1",
      approval: approval && {
        controlled: true,
        canAccessDraft: true,
        unpublished: false,
        ...approval,
      },
    } as unknown as IPage,
  } as ReturnType<typeof usePageQuery>);
  vi.mocked(usePageVerificationInfoQuery).mockReturnValue({
    data: info,
    isLoading: false,
  } as ReturnType<typeof usePageVerificationInfoQuery>);

  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={["/s/space/p/title-slug-1"]}>
        <Routes>
          <Route
            path="/s/:spaceSlug/p/:pageSlug"
            element={<PageVerificationBadge readOnly={readOnly} />}
          />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  vi.mocked(useHasFeature).mockReturnValue(true);
  getDefaultStore().set(historyAtoms, false);
});

afterEach(cleanup);

describe("PageVerificationBadge for readers of a controlled page", () => {
  const reader = { canAccessDraft: false };

  it("shows the approved version number and who approved it", async () => {
    renderBadge(
      {
        status: "approved",
        readerVersion: {
          number: 3,
          approvedAt: "2026-10-12T09:00:00Z",
          approvedBy: { id: "u-1", name: "Ada", avatarUrl: null },
          changeSummary: "Updated the torque values",
        },
      },
      reader,
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approved · v3" }));

    expect(await screen.findByText("Approved by Ada 3 days ago")).toBeTruthy();
    expect(screen.getByText("Oct 12, 2026")).toBeTruthy();
    expect(screen.getByText("Updated the torque values")).toBeTruthy();
  });

  it("labels the content that existed before approval as not yet approved", async () => {
    renderBadge({ status: "not_approved" }, reader, true);

    fireEvent.click(screen.getByRole("button", { name: "Not yet approved" }));

    expect(
      await screen.findByText(
        "This content was published before approval was turned on.",
      ),
    ).toBeTruthy();
  });

  it("labels an obsolete page", () => {
    renderBadge({ status: "obsolete" }, reader, true);

    expect(screen.getByRole("button", { name: "Obsolete" })).toBeTruthy();
  });

  it("never offers the workflow to a reader", async () => {
    renderBadge(
      {
        status: "approved",
        readerVersion: { number: 3, approvedAt: null, approvedBy: null },
      },
      reader,
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approved · v3" }));

    expect(await screen.findByText("Approved by Someone 3 days ago")).toBeTruthy();
    expect(screen.queryByTestId("manage-form")).toBeNull();
    expect(screen.queryByTestId("setup-form")).toBeNull();
  });
});

describe("PageVerificationBadge for users with draft access", () => {
  const editor = { canAccessDraft: true };

  it("keeps the status label and adds draft changes once approved", () => {
    renderBadge({ status: "approved", hasDraftChanges: true }, editor);

    expect(
      screen.getByRole("button", { name: "Approved, Draft changes" }),
    ).toBeTruthy();
    expect(screen.getByText(/Draft changes/)).toBeTruthy();
  });

  it("shows the plain status when the draft matches what readers see", () => {
    renderBadge({ status: "approved", hasDraftChanges: false }, editor);

    expect(screen.getByRole("button", { name: "Approved" })).toBeTruthy();
    expect(screen.queryByText(/Draft changes/)).toBeNull();
  });

  it("does not repeat the draft state on a page that is already a draft", () => {
    renderBadge({ status: "draft", hasDraftChanges: true }, editor);

    expect(screen.getByRole("button", { name: "Draft" })).toBeTruthy();
    expect(screen.queryByText(/Draft changes/)).toBeNull();
  });

  it("shows a controlled page without an approval row as a draft", async () => {
    renderBadge({ status: "none" }, editor);

    fireEvent.click(screen.getByRole("button", { name: "Draft" }));

    expect(await screen.findByTestId("setup-form")).toBeTruthy();
  });

  it("opens the workflow from the badge", async () => {
    renderBadge({ status: "in_approval" }, editor);

    fireEvent.click(screen.getByRole("button", { name: "In Approval" }));

    expect(await screen.findByTestId("manage-form")).toBeTruthy();
  });

  it("keeps the set up icon on an uncontrolled page", () => {
    renderBadge({ status: "none" });

    expect(
      screen.getByRole("button", { name: "Set up verification" }),
    ).toBeTruthy();
  });

  it("shows nothing to a read-only user on a page without verification", () => {
    renderBadge({ status: "none" }, editor, true);

    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});

describe("PageVerificationBadge for recurring verification", () => {
  it("links to the page history when the page changed after it was verified", () => {
    renderBadge({ status: "verified", editedSinceVerified: true });

    fireEvent.click(screen.getByRole("button", { name: "Edited since verified" }));

    expect(getDefaultStore().get(historyAtoms)).toBe(true);
  });

  it("stays quiet when the page was not edited", () => {
    renderBadge({ status: "verified", editedSinceVerified: false });

    expect(screen.queryByText("Edited since verified")).toBeNull();
  });
});
