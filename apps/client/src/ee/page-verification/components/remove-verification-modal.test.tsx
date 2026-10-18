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
import { removeVerification } from "@/ee/page-verification/services/page-verification-service";
import { RemoveVerificationModal } from "./remove-verification-modal";

vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  removeVerification: vi.fn(),
}));
vi.mock("@/features/page/queries/page-query", () => ({
  invalidatePageInfo: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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
  vi.mocked(removeVerification).mockReset().mockResolvedValue();
});

afterEach(cleanup);

const queryClient = new QueryClient();

function renderModal(
  props: Partial<React.ComponentProps<typeof RemoveVerificationModal>> = {},
) {
  const onClose = vi.fn();
  const onRemoved = vi.fn();
  const modal = (extra: typeof props = {}) => (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <RemoveVerificationModal
          pageId="page-1"
          opened
          onClose={onClose}
          onRemoved={onRemoved}
          {...props}
          {...extra}
        />
      </MantineProvider>
    </QueryClientProvider>
  );
  const view = render(modal());
  return {
    onClose,
    onRemoved,
    update: (extra: typeof props) => view.rerender(modal(extra)),
  };
}

const removeButton = () => screen.getByRole("button", { name: "Remove" });

describe("RemoveVerificationModal", () => {
  it("asks what happens to draft changes before removing", () => {
    renderModal({ hasDraftChanges: true });

    expect(screen.getByLabelText("Publish the changes")).toBeTruthy();
    expect(screen.getByLabelText("Discard the changes")).toBeTruthy();
    expect((removeButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("publishes the draft when asked to", async () => {
    const { onClose, onRemoved } = renderModal({ hasDraftChanges: true });

    fireEvent.click(screen.getByLabelText("Publish the changes"));
    fireEvent.click(removeButton());

    await waitFor(() => expect(removeVerification).toHaveBeenCalledTimes(1));
    expect(removeVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      draftAction: "publish",
    });
    await waitFor(() => expect(onRemoved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("discards the draft when asked to", async () => {
    renderModal({ hasDraftChanges: true });

    fireEvent.click(screen.getByLabelText("Discard the changes"));
    fireEvent.click(removeButton());

    await waitFor(() => expect(removeVerification).toHaveBeenCalledTimes(1));
    expect(removeVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      draftAction: "discard",
    });
  });

  it("sends no draft action when nothing is waiting to be published", async () => {
    renderModal({ hasDraftChanges: false });

    expect(screen.queryByLabelText("Publish the changes")).toBeNull();
    expect((removeButton() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(removeButton());

    await waitFor(() => expect(removeVerification).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(removeVerification).mock.calls[0];
    expect(payload).toEqual({ pageId: "page-1" });
    expect("draftAction" in payload).toBe(false);
  });

  it("only offers to publish a draft that was never published", async () => {
    renderModal({ hasDraftChanges: true, canDiscard: false });

    expect(screen.getByLabelText("Publish the changes")).toBeTruthy();
    expect(screen.queryByLabelText("Discard the changes")).toBeNull();
    // Publishing is the only way out, so it is already chosen.
    expect((removeButton() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(removeButton());

    await waitFor(() => expect(removeVerification).toHaveBeenCalledTimes(1));
    expect(removeVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      draftAction: "publish",
    });
  });

  it("does not send a discard that became impossible after it was chosen", async () => {
    const { update } = renderModal({ hasDraftChanges: true });

    fireEvent.click(screen.getByLabelText("Discard the changes"));
    update({ canDiscard: false });
    fireEvent.click(removeButton());

    await waitFor(() => expect(removeVerification).toHaveBeenCalledTimes(1));
    expect(removeVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      draftAction: "publish",
    });
  });

  it("starts over with no choice after it was closed", () => {
    const { onClose } = renderModal({ hasDraftChanges: true });

    fireEvent.click(screen.getByLabelText("Discard the changes"));
    expect((removeButton() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(removeVerification).not.toHaveBeenCalled();
    expect((removeButton() as HTMLButtonElement).disabled).toBe(true);
  });
});
