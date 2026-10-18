import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getVerificationInfo,
  removeVerification,
  restoreObsolete,
  setupVerification,
  updateVerification,
  verifyPage,
  withdrawApproval,
} from "@/ee/page-verification/services/page-verification-service";
import type {
  IPageVerificationInfo,
  IPageVerificationPermissions,
} from "@/ee/page-verification/types/page-verification.types";
import { QmsManageContent } from "./qms-manage-content";

vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  getVerificationInfo: vi.fn(),
  setupVerification: vi.fn(),
  verifyPage: vi.fn(),
  withdrawApproval: vi.fn(),
  restoreObsolete: vi.fn(),
  updateVerification: vi.fn(),
  markObsolete: vi.fn(),
  removeVerification: vi.fn(),
  submitForApproval: vi.fn(),
  rejectApproval: vi.fn(),
}));
vi.mock("@/features/page/queries/page-query", () => ({
  invalidatePageInfo: vi.fn(),
}));
vi.mock("@mantine/modals", () => ({
  modals: { openConfirmModal: vi.fn() },
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("@/hooks/use-time-ago", () => ({ useTimeAgo: () => "5 minutes ago" }));
vi.mock("./verifier-picker", () => ({
  VerifierPicker: ({
    onSelect,
  }: {
    onSelect: (user: Record<string, string>) => void;
  }) => (
    <button
      onClick={() =>
        onSelect({
          value: "u-9",
          label: "Grace",
          email: "grace@example.com",
          avatarUrl: "",
        })
      }
    >
      pick approver
    </button>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

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

const info = (
  overrides: Partial<IPageVerificationInfo> = {},
): IPageVerificationInfo => ({
  id: "ver-1",
  type: "qms",
  status: "in_approval",
  pendingHistoryId: "h-1",
  latestReaderVersion: approvedVersion,
  hasDraftChanges: true,
  spaceRequiresApproval: false,
  verifiers: [],
  permissions: { ...none, canVerify: true },
  ...overrides,
});

const onClose = vi.fn();
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const content = (value: IPageVerificationInfo) => (
  <QueryClientProvider client={queryClient}>
    <MantineProvider>
      <QmsManageContent pageId="page-1" info={value} onClose={onClose} />
    </MantineProvider>
  </QueryClientProvider>
);

const reviewedBox = () =>
  screen.getByLabelText("I've reviewed this page for accuracy") as HTMLInputElement;
const approveButton = () =>
  screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement;
const button = (name: string) => screen.queryByRole("button", { name });

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
  onClose.mockReset();
  queryClient.clear();
  vi.mocked(verifyPage).mockReset().mockResolvedValue();
  vi.mocked(withdrawApproval).mockReset().mockResolvedValue();
  vi.mocked(restoreObsolete).mockReset().mockResolvedValue();
  vi.mocked(setupVerification).mockReset().mockResolvedValue();
  vi.mocked(updateVerification).mockReset().mockResolvedValue();
  vi.mocked(removeVerification).mockReset().mockResolvedValue();
  vi.mocked(getVerificationInfo).mockReset().mockResolvedValue(info());
});

afterEach(cleanup);

describe("QmsManageContent approval", () => {
  it("only approves once the submission has been marked as reviewed", async () => {
    render(content(info()));

    expect(approveButton().disabled).toBe(true);

    fireEvent.click(reviewedBox());
    expect(approveButton().disabled).toBe(false);
    fireEvent.click(approveButton());

    await waitFor(() => expect(verifyPage).toHaveBeenCalledTimes(1));
    expect(verifyPage).toHaveBeenCalledWith({
      pageId: "page-1",
      pendingHistoryId: "h-1",
    });
  });

  it("asks for a new review when another submission replaces the reviewed one", () => {
    const view = render(content(info()));
    fireEvent.click(reviewedBox());
    expect(approveButton().disabled).toBe(false);

    view.rerender(content(info({ pendingHistoryId: "h-2" })));

    expect(reviewedBox().checked).toBe(false);
    expect(approveButton().disabled).toBe(true);

    view.rerender(content(info({ pendingHistoryId: "h-1" })));

    expect(reviewedBox().checked).toBe(false);
    expect(approveButton().disabled).toBe(true);
  });

  it("approves the replacement submission once that one was reviewed", async () => {
    const view = render(content(info()));
    fireEvent.click(reviewedBox());
    view.rerender(content(info({ pendingHistoryId: "h-2" })));
    fireEvent.click(reviewedBox());
    fireEvent.click(approveButton());

    await waitFor(() => expect(verifyPage).toHaveBeenCalledTimes(1));
    expect(verifyPage).toHaveBeenCalledWith({
      pageId: "page-1",
      pendingHistoryId: "h-2",
    });
  });

  it("clears the review mark when the server says the submission changed", async () => {
    vi.mocked(verifyPage).mockRejectedValue({
      response: { status: 409, data: { message: "submission changed" } },
    });
    render(content(info()));

    fireEvent.click(reviewedBox());
    fireEvent.click(approveButton());

    await waitFor(() => expect(reviewedBox().checked).toBe(false));
    expect(approveButton().disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cannot be approved without a pending submission", () => {
    render(content(info({ pendingHistoryId: null })));

    expect(reviewedBox().disabled).toBe(true);
    expect(approveButton().disabled).toBe(true);
  });
});

describe("QmsManageContent actions", () => {
  it("lets an editor withdraw a submission", async () => {
    render(
      content(info({ permissions: { ...none, canWithdraw: true } })),
    );

    expect(button("Approve")).toBeNull();
    fireEvent.click(button("Withdraw"));

    await waitFor(() => expect(withdrawApproval).toHaveBeenCalledWith("page-1"));
  });

  it("restores an obsolete page for a manager only", async () => {
    const view = render(
      content(
        info({
          status: "obsolete",
          pendingHistoryId: null,
          permissions: { ...none, canManage: true },
        }),
      ),
    );

    fireEvent.click(button("Restore from obsolete"));
    await waitFor(() => expect(restoreObsolete).toHaveBeenCalledWith("page-1"));

    view.rerender(
      content(
        info({ status: "obsolete", pendingHistoryId: null, permissions: none }),
      ),
    );
    expect(button("Restore from obsolete")).toBeNull();
  });

  it("opens the submit dialog when there are changes to submit", async () => {
    render(
      content(
        info({
          status: "draft",
          pendingHistoryId: null,
          permissions: { ...none, canSubmitForApproval: true },
        }),
      ),
    );

    fireEvent.click(button("Submit for approval"));

    expect(await screen.findByLabelText(/Change summary/)).toBeTruthy();
  });

  it("explains instead of offering a submission without changes", () => {
    render(
      content(
        info({
          status: "approved",
          pendingHistoryId: null,
          hasDraftChanges: false,
          permissions: { ...none, canSubmitForApproval: true },
        }),
      ),
    );

    expect(button("Submit for approval")).toBeNull();
    expect(screen.getByText("No changes to submit")).toBeTruthy();
  });
});

describe("QmsManageContent removal", () => {
  const manager = { ...none, canManage: true, canRemove: true };

  it("offers to remove approval from a page that has its own", () => {
    render(content(info({ status: "approved", permissions: manager })));

    expect(button("Remove verification")).toBeTruthy();
  });

  it("hides removal in a space that requires approval", () => {
    render(
      content(
        info({
          status: "approved",
          spaceRequiresApproval: true,
          permissions: manager,
        }),
      ),
    );

    expect(button("Remove verification")).toBeNull();
  });

  it("asks what happens to draft changes", async () => {
    render(
      content(
        info({ status: "approved", hasDraftChanges: true, permissions: manager }),
      ),
    );

    fireEvent.click(button("Remove verification"));

    expect(await screen.findByLabelText("Publish the changes")).toBeTruthy();
    expect(screen.getByLabelText("Discard the changes")).toBeTruthy();
  });

  it("only offers to publish the draft of a page that was never published", async () => {
    render(
      content(
        info({
          status: "draft",
          pendingHistoryId: null,
          latestReaderVersion: null,
          hasDraftChanges: true,
          permissions: manager,
        }),
      ),
    );

    fireEvent.click(button("Remove verification"));

    expect(await screen.findByLabelText("Publish the changes")).toBeTruthy();
    expect(screen.queryByLabelText("Discard the changes")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removeVerification).toHaveBeenCalledTimes(1));
    expect(removeVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      draftAction: "publish",
    });
  });

  it("never offers removal on a row the server does not let this user remove", () => {
    // A leftover approval row on a base reports no approval rights at all.
    render(
      content(
        info({
          status: "in_approval",
          pendingHistoryId: null,
          hasDraftChanges: undefined,
          spaceRequiresApproval: undefined,
          permissions: { ...none, canManage: true },
        }),
      ),
    );

    expect(button("Remove verification")).toBeNull();
    expect(button("Approve")).toBeNull();
    expect(button("Withdraw")).toBeNull();
    expect(screen.queryByLabelText("I've reviewed this page for accuracy")).toBeNull();
  });
});

describe("QmsManageContent approvers", () => {
  const approvers = [
    { id: "u-1", name: "Ada", email: "ada@example.com", avatarUrl: null },
  ];

  it("lets a manager add and remove approvers", () => {
    render(
      content(
        info({
          status: "approved",
          verifiers: approvers,
          permissions: { ...none, canManage: true },
        }),
      ),
    );

    expect(button("Remove Ada")).toBeTruthy();
    expect(screen.getByText("pick approver")).toBeTruthy();
  });

  it("only lists the approvers for everyone else", () => {
    render(
      content(
        info({
          status: "approved",
          verifiers: approvers,
          permissions: { ...none, canSubmitForApproval: true },
        }),
      ),
    );

    expect(screen.getByText("Ada")).toBeTruthy();
    expect(button("Remove Ada")).toBeNull();
    expect(screen.queryByText("pick approver")).toBeNull();
  });

  it("lets a manager add page approvers next to the space approvers", () => {
    render(
      content(
        info({
          status: "approved",
          verifiers: [],
          spaceRequiresApproval: true,
          permissions: { ...none, canManage: true },
        }),
      ),
    );

    expect(screen.getByText("pick approver")).toBeTruthy();
    expect(
      screen.getByText("Approvers set for this space always apply to this page."),
    ).toBeTruthy();
  });

  it("updates the approvers of a page that has an approval row", async () => {
    render(
      content(
        info({
          status: "approved",
          verifiers: approvers,
          spaceRequiresApproval: true,
          permissions: { ...none, canManage: true },
        }),
      ),
    );

    fireEvent.click(screen.getByText("pick approver"));

    await waitFor(() => expect(updateVerification).toHaveBeenCalledTimes(1));
    expect(updateVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      verifierIds: ["u-1", "u-9"],
    });
    expect(setupVerification).not.toHaveBeenCalled();
  });

  it("sets approval up with the first page approver on a page that has no approval row", async () => {
    // The server answers such a page with a draft that has no id.
    render(
      content(
        info({
          id: null,
          status: "draft",
          source: "space",
          pendingHistoryId: null,
          spaceRequiresApproval: true,
          verifiers: [],
          permissions: { ...none, canManage: true },
        }),
      ),
    );

    fireEvent.click(screen.getByText("pick approver"));

    await waitFor(() => expect(setupVerification).toHaveBeenCalledTimes(1));
    expect(setupVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      type: "qms",
      verifierIds: ["u-9"],
    });
    expect(updateVerification).not.toHaveBeenCalled();
  });

  it("lets a manager drop the last page approver of an approval space", async () => {
    render(
      content(
        info({
          status: "approved",
          verifiers: approvers,
          spaceRequiresApproval: true,
          permissions: { ...none, canManage: true },
        }),
      ),
    );

    fireEvent.click(button("Remove Ada"));

    await waitFor(() => expect(updateVerification).toHaveBeenCalledTimes(1));
    expect(updateVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      verifierIds: [],
    });
  });

  it("offers no approver editing on a page without an approval row to someone who may not manage it", () => {
    render(
      content(
        info({
          id: null,
          status: "draft",
          pendingHistoryId: null,
          spaceRequiresApproval: true,
          verifiers: [],
          permissions: { ...none, canSubmitForApproval: true },
        }),
      ),
    );

    expect(screen.queryByText("pick approver")).toBeNull();
  });
});
