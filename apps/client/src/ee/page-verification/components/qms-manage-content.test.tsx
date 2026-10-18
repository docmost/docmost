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
  restoreObsolete,
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
  VerifierPicker: () => <div data-testid="picker" />,
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
    expect(screen.getByTestId("picker")).toBeTruthy();
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
    expect(screen.queryByTestId("picker")).toBeNull();
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

    expect(screen.getByTestId("picker")).toBeTruthy();
    expect(
      screen.getByText("Approvers set for this space always apply to this page."),
    ).toBeTruthy();
  });
});
