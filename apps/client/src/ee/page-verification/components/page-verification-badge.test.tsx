import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Menu, MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDefaultStore } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms";
import { usePageQuery } from "@/features/page/queries/page-query";
import type { IPage, IPageApproval } from "@/features/page/types/page.types";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { removeVerification } from "@/ee/page-verification/services/page-verification-service";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import type {
  IPageVerificationInfo,
  IPageVerificationPermissions,
} from "@/ee/page-verification/types/page-verification.types";
import {
  PageVerificationBadge,
  PageVerificationMenuItem,
} from "./page-verification-modal";

vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: vi.fn(),
  invalidatePageInfo: vi.fn(),
}));
vi.mock("@/ee/hooks/use-feature", () => ({ useHasFeature: vi.fn() }));
vi.mock("@/ee/hooks/use-upgrade-label", () => ({
  useUpgradeLabel: () => "Upgrade your plan",
}));
vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  removeVerification: vi.fn(),
}));
vi.mock(
  "@/ee/page-verification/queries/page-verification-query",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/ee/page-verification/queries/page-verification-query")
    >()),
    usePageVerificationInfoQuery: vi.fn(),
  }),
);
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const none: IPageVerificationPermissions = {
  canVerify: false,
  canManage: false,
  canSubmitForApproval: false,
  canMarkObsolete: false,
  canWithdraw: false,
  canRemove: false,
};

const approvedVersion = {
  id: "v-3",
  kind: "approved" as const,
  number: 3,
  approvedAt: "2026-10-12T09:00:00Z",
  approvedBy: null,
};

// The query hook is mocked, so it must answer like the real one: nothing without a page id.
function mockInfo(info: IPageVerificationInfo | undefined) {
  vi.mocked(usePageVerificationInfoQuery).mockImplementation(
    (pageId) =>
      ({
        data: pageId ? info : undefined,
        isLoading: false,
      }) as ReturnType<typeof usePageVerificationInfoQuery>,
  );
}

function mockPage(approval?: Partial<IPageApproval>) {
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
}

function renderBadge(
  info: IPageVerificationInfo | undefined,
  approval?: Partial<IPageApproval>,
  readOnly = false,
) {
  mockPage(approval);
  mockInfo(info);

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter initialEntries={["/s/space/p/title-slug-1"]}>
          <Routes>
            <Route
              path="/s/:spaceSlug/p/:pageSlug"
              element={<PageVerificationBadge readOnly={readOnly} />}
            />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

function renderMenuItem(
  info: IPageVerificationInfo | undefined,
  approval?: Partial<IPageApproval>,
) {
  mockPage(approval);
  mockInfo(info);
  const onClick = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Menu opened withinPortal={false} transitionProps={{ duration: 0 }}>
          <Menu.Target>
            <button>menu</button>
          </Menu.Target>
          <Menu.Dropdown>
            <PageVerificationMenuItem pageId="page-1" onClick={onClick} />
          </Menu.Dropdown>
        </Menu>
      </MantineProvider>
    </QueryClientProvider>,
  );
  return { onClick };
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
  vi.mocked(removeVerification).mockReset().mockResolvedValue();
  vi.mocked(usePageVerificationInfoQuery).mockReset();
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
      screen.getByRole("button", { name: "Approved, draft changes" }),
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

  it("shows a page in an approval space without an approval row as a draft and opens its workflow", async () => {
    // The server answers such pages with a draft that has no id.
    renderBadge(
      {
        id: null,
        type: "qms",
        status: "draft",
        source: "space",
        spaceRequiresApproval: true,
        latestReaderVersion: null,
        hasDraftChanges: true,
        permissions: { ...none, canManage: true, canSubmitForApproval: true },
      },
      { canAccessDraft: true, unpublished: true },
    );

    fireEvent.click(screen.getByRole("button", { name: "Draft" }));

    expect(await screen.findByTestId("manage-form")).toBeTruthy();
    expect(screen.queryByTestId("setup-form")).toBeNull();
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
    renderBadge({ status: "none" }, undefined, true);

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

describe("without the verification licence", () => {
  const manager = { ...none, canManage: true, canRemove: true };
  const editor = { canAccessDraft: true };

  const approvedPage = (overrides: Partial<IPageVerificationInfo> = {}) => ({
    type: "qms" as const,
    status: "approved" as const,
    spaceRequiresApproval: false,
    latestReaderVersion: approvedVersion,
    hasDraftChanges: false,
    permissions: manager,
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(useHasFeature).mockReturnValue(false);
  });

  it("keeps the upgrade icon on a page that approval does not control and does not look it up", () => {
    renderBadge({ status: "none" });

    expect(
      screen.getByRole("button", { name: /Add verification/ }),
    ).toBeTruthy();
    const asked = vi
      .mocked(usePageVerificationInfoQuery)
      .mock.calls.map(([pageId]) => pageId);
    expect(asked.every((pageId) => pageId === undefined)).toBe(true);
  });

  it("shows nothing to a read-only user on such a page", () => {
    renderBadge({ status: "none" }, undefined, true);

    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("lets a manager open a limited view of approval that can only remove it", async () => {
    renderBadge(approvedPage(), editor);

    fireEvent.click(screen.getByRole("button", { name: "Approved" }));

    expect(
      await screen.findByText(
        "Approval needs a paid plan. You can still remove it from this page.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Upgrade your plan")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(screen.queryByTestId("manage-form")).toBeNull();
    expect(screen.queryByTestId("setup-form")).toBeNull();
    for (const name of [
      "Submit for approval",
      "Approve",
      "Withdraw",
      "Mark obsolete",
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("removes approval without draft changes straight away", async () => {
    renderBadge(approvedPage(), editor);

    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removeVerification).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(removeVerification).mock.calls[0];
    expect(payload).toEqual({ pageId: "page-1" });
  });

  it("still asks what happens to draft changes", async () => {
    renderBadge(approvedPage({ hasDraftChanges: true }), editor);

    fireEvent.click(
      screen.getByRole("button", { name: "Approved, draft changes" }),
    );
    fireEvent.click(await screen.findByLabelText("Discard the changes"));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removeVerification).toHaveBeenCalledTimes(1));
    expect(removeVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      draftAction: "discard",
    });
  });

  it("opens the limited view for a manager who cannot edit the page", async () => {
    renderBadge(approvedPage(), editor, true);

    fireEvent.click(screen.getByRole("button", { name: "Approved" }));

    expect(await screen.findByRole("button", { name: "Remove" })).toBeTruthy();
  });

  it("keeps the upgrade icon for an editor who may not remove approval", () => {
    renderBadge(
      approvedPage({ permissions: { ...none, canSubmitForApproval: true } }),
      editor,
    );

    expect(
      screen.getByRole("button", { name: /Add verification/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approved" })).toBeNull();
  });

  it("shows nothing to a reader of an approved page", () => {
    renderBadge(
      { status: "approved", readerVersion: null },
      { canAccessDraft: false },
      true,
    );

    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("gives the menu item to a manager who may remove approval", () => {
    const { onClick } = renderMenuItem(approvedPage(), editor);

    const item = screen.getByRole("menuitem", { name: "Edit verification" });
    expect((item as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(item);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps the menu item locked for everyone else", () => {
    const { onClick } = renderMenuItem(
      approvedPage({ permissions: none }),
      editor,
    );

    const item = screen.getByRole("menuitem", { name: "Edit verification" });
    expect((item as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(item);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the menu item locked on a page approval does not control and does not look it up", () => {
    renderMenuItem({ status: "none" });

    const item = screen.getByRole("menuitem", { name: "Add verification" });
    expect((item as HTMLButtonElement).disabled).toBe(true);
    const asked = vi
      .mocked(usePageVerificationInfoQuery)
      .mock.calls.map(([pageId]) => pageId);
    expect(asked.every((pageId) => pageId === undefined)).toBe(true);
  });
});

describe("PageVerificationMenuItem with the licence", () => {
  it("offers to set up verification on a page without any", () => {
    const { onClick } = renderMenuItem({ status: "none" });

    fireEvent.click(screen.getByRole("menuitem", { name: "Add verification" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("offers to edit the verification of a page in an approval space that has no approval row", () => {
    renderMenuItem(
      {
        id: null,
        type: "qms",
        status: "draft",
        source: "space",
        spaceRequiresApproval: true,
      },
      { canAccessDraft: true },
    );

    expect(
      screen.getByRole("menuitem", { name: "Edit verification" }),
    ).toBeTruthy();
  });
});
