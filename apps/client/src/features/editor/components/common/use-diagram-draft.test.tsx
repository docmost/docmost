import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { modals } from "@mantine/modals";
import {
  writeDiagramDraft,
  discardDiagramDraft,
} from "@/features/attachments/services/diagram-service";
import { uploadFile } from "@/features/page/services/page-service";
import { useDiagramDraft } from "./use-diagram-draft";
import { notifyDiagramSaveError } from "./diagram-save-error";

vi.mock("@/features/page/services/page-service", () => ({
  uploadFile: vi.fn(),
}));
vi.mock("@/features/attachments/services/diagram-service", () => ({
  writeDiagramDraft: vi.fn(async () => {}),
  discardDiagramDraft: vi.fn(async () => {}),
}));
vi.mock("./diagram-save-error", () => ({ notifyDiagramSaveError: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string) => s }),
}));

function setup() {
  const session = {
    draft: { pageId: "page", draftId: "stable-key", type: "drawio" as const },
    fileName: "Network.drawio.svg",
    previousAttachmentId: "published",
    initial: null,
    recovered: false,
    zoom: null,
    update: vi.fn(),
  };
  const close = vi.fn();
  const { result } = renderHook(() =>
    useDiagramDraft({ session, onClose: close }),
  );
  return { session, close, result };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it("keeps the editor’s latest change in their draft when the page has moved on", async () => {
  const { session, close, result } = setup();
  session.update.mockImplementation(() => {
    throw new Error("Diagram changed");
  });
  act(() => {
    result.current.markChanged();
    result.current.publish(() => "<svg/>");
  });
  await waitFor(() => expect(notifyDiagramSaveError).toHaveBeenCalled());
  expect(writeDiagramDraft).toHaveBeenCalledWith(
    session.draft,
    expect.any(File),
  );
  expect(uploadFile).not.toHaveBeenCalled();
  expect(discardDiagramDraft).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it("discards a private autosave without changing the attachment or the node", async () => {
  const { session, close, result } = setup();
  const confirm = vi
    .spyOn(modals, "openConfirmModal")
    .mockReturnValue("discard");
  act(() => {
    result.current.markChanged();
    result.current.autosave(() => "<svg/>");
  });
  await waitFor(() => expect(writeDiagramDraft).toHaveBeenCalledTimes(1));
  act(() => result.current.requestClose());
  expect(close).not.toHaveBeenCalled();
  act(() => {
    confirm.mock.calls[0][0].onConfirm?.();
  });
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(discardDiagramDraft).toHaveBeenCalledWith(session.draft);
  expect(uploadFile).not.toHaveBeenCalled();
  expect(session.update).not.toHaveBeenCalled();
});
