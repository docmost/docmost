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
  within,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDefaultStore } from "jotai";
import type { Editor } from "@tiptap/core";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import type { IPageHistory } from "@/features/page-history/types/page.types";
import { usePageQuery } from "@/features/page/queries/page-query";
import {
  rejectApproval,
  verifyPage,
} from "@/ee/page-verification/services/page-verification-service";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import type { IPageVerificationInfo } from "@/ee/page-verification/types/page-verification.types";
import { ApprovalCompareModal } from "./approval-compare-modal";

const { diffProps } = vi.hoisted(() => ({
  diffProps: { current: undefined as Record<string, unknown> | undefined },
}));

vi.mock("@/features/page-history/components/history-editor", () => ({
  HistoryEditor: (props: Record<string, unknown>) => {
    diffProps.current = props;
    return <div data-testid="diff">{props.title as string}</div>;
  },
}));
vi.mock("@/features/page-history/queries/page-history-query", () => ({
  usePageHistoryQuery: vi.fn(),
}));
vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: vi.fn(),
  invalidatePageInfo: vi.fn(),
}));
vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  verifyPage: vi.fn(),
  rejectApproval: vi.fn(),
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
vi.mock("@/hooks/use-time-ago", () => ({ useTimeAgo: () => "5 minutes ago" }));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

const history = (
  id: string,
  overrides: Partial<IPageHistory> = {},
): IPageHistory =>
  ({
    id,
    title: "Torque spec",
    icon: "",
    content: { type: "doc", content: [{ type: "paragraph", attrs: { id } }] },
    ...overrides,
  }) as IPageHistory;

let histories: Record<string, IPageHistory>;
let info: IPageVerificationInfo;

const reviewInfo = (
  overrides: Partial<IPageVerificationInfo> = {},
): IPageVerificationInfo => ({
  status: "in_approval",
  pendingHistoryId: "h-2",
  pendingSubmission: {
    changeSummary: "Updated the torque values",
    requestedBy: { id: "u-1", name: "Ada", avatarUrl: null },
    requestedAt: "2026-10-18T09:00:00Z",
  },
  latestReaderVersion: {
    id: "h-1",
    kind: "approved",
    number: 3,
    approvedAt: "2026-10-12T09:00:00Z",
    approvedBy: null,
  },
  permissions: {
    canVerify: true,
    canManage: false,
    canSubmitForApproval: false,
    canMarkObsolete: false,
    canWithdraw: false,
    canRemove: false,
  },
  ...overrides,
});

function mockQueries() {
  vi.mocked(usePageVerificationInfoQuery).mockImplementation(
    () => ({ data: info }) as ReturnType<typeof usePageVerificationInfoQuery>,
  );
  vi.mocked(usePageHistoryQuery).mockImplementation(
    (id: string) =>
      ({
        data: histories[id],
        isError: false,
        isLoading: false,
      }) as ReturnType<typeof usePageHistoryQuery>,
  );
  vi.mocked(usePageQuery).mockReturnValue({
    data: {
      id: "page-1",
      title: "Torque spec (draft)",
      icon: "",
      content: { type: "doc", content: [{ type: "paragraph" }] },
    },
  } as unknown as ReturnType<typeof usePageQuery>);
}

function modal(mode: "review" | "compare" = "review") {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ApprovalCompareModal
          pageId="page-1"
          opened
          mode={mode}
          onClose={onClose}
        />
      </MantineProvider>
    </QueryClientProvider>
  );
}

const queryClient = new QueryClient();
const onClose = vi.fn();

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
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  diffProps.current = undefined;
  onClose.mockReset();
  vi.mocked(verifyPage).mockReset().mockResolvedValue();
  vi.mocked(rejectApproval).mockReset().mockResolvedValue();
  histories = {
    "h-1": history("h-1"),
    "h-2": history("h-2", {
      title: "Torque spec v2",
      icon: "🔧",
      changeSummary: "Updated the torque values",
    }),
  };
  info = reviewInfo();
  mockQueries();
  getDefaultStore().set(pageEditorAtom as never, null);
});

afterEach(cleanup);

describe("ApprovalCompareModal review", () => {
  it("shows the submission against the version readers see", () => {
    render(modal());

    expect(screen.getByTestId("diff").textContent).toBe("Torque spec v2");
    expect(diffProps.current).toMatchObject({
      title: "Torque spec v2",
      content: histories["h-2"].content,
      previousContent: histories["h-1"].content,
    });
    expect(screen.getByText("Compared with version 3")).toBeTruthy();
    expect(screen.getByText("Updated the torque values")).toBeTruthy();
    expect(screen.getByText("Submitted by Ada 5 minutes ago")).toBeTruthy();
  });

  it("approves the submission it rendered", async () => {
    render(modal());

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(verifyPage).toHaveBeenCalledTimes(1));
    expect(verifyPage).toHaveBeenCalledWith({
      pageId: "page-1",
      pendingHistoryId: "h-2",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("cannot approve a replacement submission before it is on screen", async () => {
    const view = render(modal());
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();

    info = reviewInfo({ pendingHistoryId: "h-3" });
    view.rerender(modal());

    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();

    histories["h-3"] = history("h-3", { title: "Torque spec v3" });
    view.rerender(modal());

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(verifyPage).toHaveBeenCalledTimes(1));
    expect(verifyPage).toHaveBeenCalledWith({
      pageId: "page-1",
      pendingHistoryId: "h-3",
    });
  });

  it("lists the title and icon changes next to the content diff", () => {
    render(modal());

    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getAllByText("Torque spec").length).toBeGreaterThan(0);
    expect(screen.getByText("Icon")).toBeTruthy();
    expect(screen.getByText("None")).toBeTruthy();
    expect(screen.getByText("🔧")).toBeTruthy();
  });

  it("leaves out title and icon rows when they did not change", () => {
    histories["h-2"] = history("h-2", { title: "Torque spec" });
    render(modal());

    expect(screen.queryByText("Icon")).toBeNull();
    expect(screen.queryByText("None")).toBeNull();
  });

  it("sends the comment when changes are requested", async () => {
    render(modal());

    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Request changes",
    });
    const submit = within(dialog).getByRole("button", {
      name: "Request changes",
    });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Comment"), {
      target: { value: "  Add the new torque table  " },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(rejectApproval).toHaveBeenCalledTimes(1));
    expect(rejectApproval).toHaveBeenCalledWith({
      pageId: "page-1",
      comment: "Add the new torque table",
    });
    expect(verifyPage).not.toHaveBeenCalled();
  });

  it("offers no decision to a user who cannot approve", () => {
    info = reviewInfo({
      permissions: { ...reviewInfo().permissions, canVerify: false },
    });
    render(modal());

    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Request changes" })).toBeNull();
  });

  it("says so when the submission is no longer in review", () => {
    info = reviewInfo({ status: "draft", pendingHistoryId: null });
    render(modal());

    expect(screen.getByText("This submission is no longer in review.")).toBeTruthy();
    expect(screen.queryByTestId("diff")).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("reviews a first submission without a version to compare with", () => {
    info = reviewInfo({ latestReaderVersion: null });
    render(modal());

    expect(
      screen.getByText("There is no earlier version to compare with."),
    ).toBeTruthy();
    expect(diffProps.current?.previousContent).toBeUndefined();
    expect(screen.queryByText("Title")).toBeNull();
  });
});

describe("ApprovalCompareModal compare", () => {
  it("compares the live draft with the version readers see", () => {
    const liveContent = { type: "doc", content: [{ type: "heading" }] };
    getDefaultStore().set(pageEditorAtom as never, {
      isDestroyed: false,
      getJSON: () => liveContent,
    } as unknown as Editor);
    info = reviewInfo({ status: "approved", pendingHistoryId: null });

    render(modal("compare"));

    expect(diffProps.current).toMatchObject({
      title: "Torque spec (draft)",
      content: liveContent,
      previousContent: histories["h-1"].content,
    });
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByText(/Submitted by/)).toBeNull();
  });

  it("falls back to the loaded draft without a live editor", () => {
    info = reviewInfo({ status: "approved", pendingHistoryId: null });

    render(modal("compare"));

    expect(diffProps.current?.content).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});
