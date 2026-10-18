import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  getVerificationInfo,
  submitForApproval,
} from "@/ee/page-verification/services/page-verification-service";
import type { IPageVerificationInfo } from "@/ee/page-verification/types/page-verification.types";
import { SubmitApprovalModal } from "./submit-approval-modal";

vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  getVerificationInfo: vi.fn(),
  submitForApproval: vi.fn(),
}));
vi.mock("@/features/page/queries/page-query", () => ({
  invalidatePageInfo: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

const info = (
  overrides: Partial<IPageVerificationInfo> = {},
): IPageVerificationInfo => ({
  status: "draft",
  verifiers: [
    { id: "u-1", name: "Ada", email: "ada@example.com", avatarUrl: null },
  ],
  ...overrides,
});

function renderModal() {
  const onClose = vi.fn();
  const onSubmitted = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MantineProvider>
        <SubmitApprovalModal
          pageId="page-1"
          opened
          onClose={onClose}
          onSubmitted={onSubmitted}
        />
      </MantineProvider>
    </QueryClientProvider>,
  );
  return { onClose, onSubmitted };
}

const summaryBox = () => screen.getByLabelText(/Change summary/) as HTMLTextAreaElement;
const submitButton = () =>
  screen.getByRole("button", { name: "Submit for approval" }) as HTMLButtonElement;

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
  vi.mocked(getVerificationInfo).mockReset().mockResolvedValue(info());
  vi.mocked(submitForApproval).mockReset().mockResolvedValue();
  vi.mocked(notifications.show).mockReset();
});

afterEach(cleanup);

describe("SubmitApprovalModal", () => {
  it("needs a change summary before it can submit", () => {
    renderModal();

    expect(submitButton().disabled).toBe(true);

    fireEvent.change(summaryBox(), { target: { value: "   " } });
    expect(submitButton().disabled).toBe(true);

    fireEvent.change(summaryBox(), { target: { value: "Updated torque" } });
    expect(submitButton().disabled).toBe(false);
  });

  it("sends the trimmed summary and closes", async () => {
    const { onClose, onSubmitted } = renderModal();

    fireEvent.change(summaryBox(), {
      target: { value: "  Updated the torque values  " },
    });
    fireEvent.click(submitButton());

    await waitFor(() => expect(submitForApproval).toHaveBeenCalledTimes(1));
    expect(submitForApproval).toHaveBeenCalledWith({
      pageId: "page-1",
      changeSummary: "Updated the torque values",
    });
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("limits the summary to what the server accepts", () => {
    renderModal();

    expect(summaryBox().maxLength).toBe(2000);
  });

  it("stays open and shows the server message when nothing changed", async () => {
    vi.mocked(submitForApproval).mockRejectedValue({
      response: { status: 400, data: { message: "No changes to submit" } },
    });
    const { onClose, onSubmitted } = renderModal();

    fireEvent.change(summaryBox(), { target: { value: "Updated torque" } });
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith({
        message: "No changes to submit",
        color: "red",
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(summaryBox().value).toBe("Updated torque");
  });

  it("lists the approvers who will be asked", async () => {
    renderModal();

    expect(await screen.findByText("Ada")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Approvers" })).toBeTruthy();
    expect(
      screen.queryByText("Approvers set for this space are notified as well."),
    ).toBeNull();
  });

  it("also mentions the approvers of a space that requires approval", async () => {
    vi.mocked(getVerificationInfo).mockResolvedValue(
      info({ spaceRequiresApproval: true }),
    );
    renderModal();

    expect(await screen.findByText("Ada")).toBeTruthy();
    expect(
      screen.getByText("Approvers set for this space are notified as well."),
    ).toBeTruthy();
  });

  it("names the space's approvers when the page has none of its own", async () => {
    vi.mocked(getVerificationInfo).mockResolvedValue(
      info({ verifiers: [], spaceRequiresApproval: true }),
    );
    renderModal();

    expect(
      await screen.findByText(
        "Approvers set for this space are notified as well.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Approvers" })).toBeTruthy();
  });
});
