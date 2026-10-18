import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { modals } from "@mantine/modals";
import { usePageQuery } from "@/features/page/queries/page-query";
import type { IPage, IPageApproval } from "@/features/page/types/page.types";
import { useHasFeature } from "@/ee/hooks/use-feature";
import {
  verifyPage,
  withdrawApproval,
} from "@/ee/page-verification/services/page-verification-service";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import type {
  IPageVerificationInfo,
  IPageVerificationPermissions,
} from "@/ee/page-verification/types/page-verification.types";
import { ApprovalBanner } from "./approval-banner";

vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: vi.fn(),
  invalidatePageInfo: vi.fn(),
}));
vi.mock("@/ee/hooks/use-feature", () => ({ useHasFeature: vi.fn() }));
vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  verifyPage: vi.fn(),
  withdrawApproval: vi.fn(),
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
vi.mock("@mantine/modals", () => ({
  modals: { openConfirmModal: vi.fn() },
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("@/hooks/use-time-ago", () => ({ useTimeAgo: () => "5 minutes ago" }));
vi.mock("@/lib/date-locale", () => ({
  useDateFnsLocale: () => ({}),
  formatLocalized: () => "Oct 12, 2026",
}));
vi.mock("./approval-compare-modal", () => ({
  ApprovalCompareModal: ({
    opened,
    mode,
  }: {
    opened: boolean;
    mode: string;
  }) => (opened ? <div data-testid={`diff-${mode}`} /> : null),
}));
vi.mock("./submit-approval-modal", () => ({
  SubmitApprovalModal: ({ opened }: { opened: boolean }) =>
    opened ? <div data-testid="submit-modal" /> : null,
}));
vi.mock("./request-changes-modal", () => ({
  RequestChangesModal: ({ opened }: { opened: boolean }) =>
    opened ? <div data-testid="request-changes-modal" /> : null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

const approvedVersion = {
  id: "v-3",
  kind: "approved" as const,
  number: 3,
  approvedAt: "2026-10-12T09:00:00Z",
  approvedBy: null,
};

const none: IPageVerificationPermissions = {
  canVerify: false,
  canManage: false,
  canSubmitForApproval: false,
  canMarkObsolete: false,
  canWithdraw: false,
  canRemove: false,
};

const editor = { ...none, canSubmitForApproval: true, canWithdraw: true };
const approver = { ...none, canVerify: true };

const draftInfo = (
  overrides: Partial<IPageVerificationInfo> = {},
): IPageVerificationInfo => ({
  status: "approved",
  latestReaderVersion: approvedVersion,
  hasDraftChanges: true,
  permissions: editor,
  ...overrides,
});

const reviewInfo = (
  permissions: IPageVerificationPermissions,
  overrides: Partial<IPageVerificationInfo> = {},
): IPageVerificationInfo =>
  draftInfo({
    status: "in_approval",
    pendingHistoryId: "h-2",
    pendingSubmission: {
      changeSummary: "Updated the torque values",
      requestedBy: { id: "u-1", name: "Ada", avatarUrl: null },
      requestedAt: "2026-10-18T09:00:00Z",
    },
    permissions,
    ...overrides,
  });

const queryClient = new QueryClient();

const bannerTree = () => (
  <QueryClientProvider client={queryClient}>
    <MantineProvider>
      <ApprovalBanner slugId="slug-1" />
    </MantineProvider>
  </QueryClientProvider>
);

function mockInfo(info: IPageVerificationInfo | undefined) {
  vi.mocked(usePageVerificationInfoQuery).mockReturnValue({
    data: info,
  } as ReturnType<typeof usePageVerificationInfoQuery>);
}

function renderBanner(
  info: IPageVerificationInfo | undefined,
  approval: Partial<IPageApproval> = {},
  page: Partial<IPage> = {},
) {
  vi.mocked(usePageQuery).mockReturnValue({
    data: {
      id: "page-1",
      slugId: "slug-1",
      deletedAt: null,
      permissions: { canEdit: true, hasRestriction: false },
      approval: {
        controlled: true,
        canAccessDraft: true,
        unpublished: false,
        ...approval,
      },
      ...page,
    },
  } as unknown as ReturnType<typeof usePageQuery>);
  mockInfo(info);

  return render(bannerTree());
}

const button = (name: string) => screen.queryByRole("button", { name });
const buttons = () =>
  screen.queryAllByRole("button").map((element) => element.textContent);
const banners = () =>
  screen.queryAllByRole("status").map((element) => element.textContent);

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
  vi.mocked(verifyPage).mockReset().mockResolvedValue();
  vi.mocked(withdrawApproval).mockReset().mockResolvedValue();
  vi.mocked(modals.openConfirmModal).mockReset();
});

afterEach(cleanup);

describe("ApprovalBanner states", () => {
  it("is not shown on an uncontrolled page", () => {
    renderBanner(draftInfo(), { controlled: false });

    expect(banners()).toEqual([]);
  });

  it("is not shown when the draft matches what readers see", () => {
    renderBanner(draftInfo({ hasDraftChanges: false }));

    expect(banners()).toEqual([]);
  });

  it("is not shown on a deleted page", () => {
    renderBanner(draftInfo(), {}, { deletedAt: new Date() });

    expect(banners()).toEqual([]);
  });

  it("tells editors an unpublished page is hidden from readers", () => {
    renderBanner(
      draftInfo({
        status: "draft",
        latestReaderVersion: null,
        hasDraftChanges: true,
      }),
      { unpublished: true },
    );

    expect(
      screen.getByText("Draft. Readers can't see this page until it's approved."),
    ).toBeTruthy();
    expect(buttons()).toEqual(["Submit for approval"]);
  });

  it("names the version readers see while the draft has changes", () => {
    renderBanner(draftInfo());

    expect(
      screen.getByText("Draft. Readers see version 3 (approved Oct 12, 2026)."),
    ).toBeTruthy();
    expect(buttons()).toEqual(["Compare", "Submit for approval"]);
  });

  it("describes a baseline without inventing a version number", () => {
    renderBanner(
      draftInfo({
        status: "draft",
        latestReaderVersion: {
          id: "v-0",
          kind: "baseline",
          number: null,
          approvedAt: null,
          approvedBy: null,
        },
      }),
    );

    expect(
      screen.getByText(
        "Draft. Readers see the content from before approval was turned on.",
      ),
    ).toBeTruthy();
  });

  it("pauses editing while a submission is in review and lets editors withdraw", () => {
    renderBanner(reviewInfo(editor), { locked: true });

    expect(
      screen.getByText("In review since 5 minutes ago by Ada. Editing is paused."),
    ).toBeTruthy();
    expect(buttons()).toEqual(["Withdraw"]);
  });

  it("gives approvers the review actions and no withdraw", () => {
    renderBanner(reviewInfo(approver), { locked: true });

    expect(buttons()).toEqual(["Review", "Approve", "Request changes"]);
  });

  it("gives someone who can both edit and approve every action", () => {
    renderBanner(
      reviewInfo({ ...editor, canVerify: true }),
      { locked: true },
    );

    expect(buttons()).toEqual([
      "Review",
      "Approve",
      "Request changes",
      "Withdraw",
    ]);
  });

  it("offers a user without a say in the review nothing to press", () => {
    renderBanner(reviewInfo(none), { locked: true });

    expect(
      screen.getByText("In review since 5 minutes ago by Ada. Editing is paused."),
    ).toBeTruthy();
    expect(buttons()).toEqual([]);
  });

  it("shows why a returned page is a draft above the draft banner", () => {
    renderBanner(
      draftInfo({
        status: "draft",
        requestedAt: "2026-10-17T10:00:00Z",
        rejectedAt: "2026-10-17T11:00:00Z",
        rejectedBy: { id: "u-2", name: "Grace", avatarUrl: null },
        rejectionComment: "Fix the torque values",
      }),
    );

    const returned = screen.getByText(
      "Changes requested by Grace: Fix the torque values",
    );
    const draft = screen.getByText(
      "Draft. Readers see version 3 (approved Oct 12, 2026).",
    );
    expect(
      returned.compareDocumentPosition(draft) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("names the version readers see on an obsolete page", () => {
    renderBanner(
      draftInfo({ status: "obsolete", hasDraftChanges: false }),
      { locked: true },
    );

    expect(
      screen.getByText("Obsolete. Readers see version 3 with an obsolete notice."),
    ).toBeTruthy();
    expect(buttons()).toEqual([]);
  });

  describe("on a page in an approval space without an approval row", () => {
    // The server answers such pages with a draft that has no id.
    const rowLess = (overrides: Partial<IPageVerificationInfo> = {}) =>
      draftInfo({
        id: null,
        type: "qms",
        status: "draft",
        source: "space",
        spaceRequiresApproval: true,
        verifiers: [],
        requestedAt: null,
        rejectedAt: null,
        ...overrides,
      });

    it("tells editors a new page is hidden from readers and lets them submit it", () => {
      renderBanner(
        rowLess({ latestReaderVersion: null, hasDraftChanges: true }),
        { unpublished: true },
      );

      expect(
        screen.getByText(
          "Draft. Readers can't see this page until it's approved.",
        ),
      ).toBeTruthy();
      expect(buttons()).toEqual(["Submit for approval"]);
    });

    it("names the baseline readers see while the draft has changes", () => {
      renderBanner(
        rowLess({
          latestReaderVersion: {
            id: "v-0",
            kind: "baseline",
            number: null,
            approvedAt: null,
            approvedBy: null,
          },
        }),
      );

      expect(
        screen.getByText(
          "Draft. Readers see the content from before approval was turned on.",
        ),
      ).toBeTruthy();
      expect(buttons()).toEqual(["Compare", "Submit for approval"]);
    });

    it("leaves the submit button to those the server allows", () => {
      renderBanner(
        rowLess({
          latestReaderVersion: null,
          hasDraftChanges: true,
          permissions: none,
        }),
        { unpublished: true },
      );

      expect(buttons()).toEqual([]);
    });
  });

  it("does not guess the right to submit from edit access", () => {
    renderBanner(draftInfo({ permissions: undefined }));

    expect(buttons()).toEqual(["Compare"]);
  });
});

describe("ApprovalBanner licence", () => {
  it("keeps withdraw but drops the licensed actions", () => {
    vi.mocked(useHasFeature).mockReturnValue(false);
    renderBanner(
      reviewInfo({ ...editor, canVerify: true }),
      { locked: true },
    );

    expect(buttons()).toEqual(["Withdraw"]);
  });

  it("drops submit without the licence", () => {
    vi.mocked(useHasFeature).mockReturnValue(false);
    renderBanner(draftInfo());

    expect(buttons()).toEqual(["Compare"]);
  });
});

describe("ApprovalBanner actions", () => {
  it("opens the submit dialog", () => {
    renderBanner(draftInfo());

    fireEvent.click(button("Submit for approval"));

    expect(screen.getByTestId("submit-modal")).toBeTruthy();
  });

  it("opens the comparison for the draft and the review for a submission", () => {
    const { unmount } = renderBanner(draftInfo());
    fireEvent.click(button("Compare"));
    expect(screen.getByTestId("diff-compare")).toBeTruthy();
    unmount();

    renderBanner(reviewInfo(approver), { locked: true });
    fireEvent.click(button("Review"));
    expect(screen.getByTestId("diff-review")).toBeTruthy();
  });

  it("opens the change request dialog", () => {
    renderBanner(reviewInfo(approver), { locked: true });

    fireEvent.click(button("Request changes"));

    expect(screen.getByTestId("request-changes-modal")).toBeTruthy();
  });

  it("withdraws the submission", async () => {
    renderBanner(reviewInfo(editor), { locked: true });

    fireEvent.click(button("Withdraw"));

    await waitFor(() => expect(withdrawApproval).toHaveBeenCalledWith("page-1"));
  });

  it("approves the submission that was on screen when it was confirmed", async () => {
    renderBanner(reviewInfo(approver), { locked: true });

    fireEvent.click(button("Approve"));

    expect(verifyPage).not.toHaveBeenCalled();
    const [config] = vi.mocked(modals.openConfirmModal).mock.calls[0];
    config.onConfirm?.();

    await waitFor(() => expect(verifyPage).toHaveBeenCalledTimes(1));
    expect(verifyPage).toHaveBeenCalledWith({
      pageId: "page-1",
      pendingHistoryId: "h-2",
    });
  });

  it("shows the change summary of the submission it is about to approve", () => {
    renderBanner(reviewInfo(approver), { locked: true });

    fireEvent.click(button("Approve"));
    const [config] = vi.mocked(modals.openConfirmModal).mock.calls[0];
    render(<MantineProvider>{config.children}</MantineProvider>);

    expect(screen.getByText(/Updated the torque values/)).toBeTruthy();
  });

  it("still approves the submission it asked about when another one replaces it before the confirmation", async () => {
    const view = renderBanner(reviewInfo(approver), { locked: true });

    fireEvent.click(button("Approve"));
    const [config] = vi.mocked(modals.openConfirmModal).mock.calls[0];

    mockInfo(reviewInfo(approver, { pendingHistoryId: "h-3" }));
    view.rerender(bannerTree());
    config.onConfirm?.();

    await waitFor(() => expect(verifyPage).toHaveBeenCalledTimes(1));
    expect(verifyPage).toHaveBeenCalledWith({
      pageId: "page-1",
      pendingHistoryId: "h-2",
    });
  });
});

describe("ApprovalBanner for readers", () => {
  const reader = { canAccessDraft: false };

  it("says an obsolete page is out of date", () => {
    renderBanner({ status: "obsolete" }, reader);

    expect(
      screen.getByText(
        "Obsolete. This page is kept for reference and may be out of date.",
      ),
    ).toBeTruthy();
    expect(buttons()).toEqual([]);
  });

  it("shows nothing else to a reader", () => {
    renderBanner({ status: "approved", readerVersion: null }, reader);

    expect(banners()).toEqual([]);
  });
});
