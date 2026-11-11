import { MantineProvider } from "@mantine/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { getDefaultStore, type PrimitiveAtom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MicrosoftFileItem } from "@docmost/editor-ext";
import {
  microsoftFullscreenAtom,
  microsoftPreviewDialogAtom,
} from "@/features/microsoft/atoms/microsoft-atoms";
import { MicrosoftFullscreenModal } from "./microsoft-fullscreen-modal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

vi.mock("@/features/microsoft/queries/microsoft-query", () => ({
  useM365Preview: () => ({ state: "loading" }),
  useM365Item: () => ({ state: "loading" }),
}));

const store = getDefaultStore();
const fullscreenAtom =
  microsoftFullscreenAtom as PrimitiveAtom<MicrosoftFileItem | null>;
const dialogAtom =
  microsoftPreviewDialogAtom as PrimitiveAtom<MicrosoftFileItem | null>;

const item: MicrosoftFileItem = {
  driveId: "drive-1",
  itemId: "item-1",
  webUrl: "https://contoso.sharepoint.com/sites/M/Shared%20Documents/Plan.docx",
  name: "Plan.docx",
};

function renderModal() {
  render(
    <MantineProvider env="test">
      <MicrosoftFullscreenModal />
    </MantineProvider>,
  );
}

const isFullScreen = (dialog: HTMLElement) =>
  dialog.closest("[data-full-screen]") !== null;

describe("MicrosoftFullscreenModal", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    store.set(fullscreenAtom, null);
    store.set(dialogAtom, null);
  });

  it("shows a file from a folder in a dialog that names it once", () => {
    renderModal();
    act(() => store.set(dialogAtom, item));

    const dialog = screen.getByRole("dialog", { name: "Plan.docx" });
    expect(isFullScreen(dialog)).toBe(false);
    expect(screen.getAllByText("Plan.docx")).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Close preview of Plan.docx" }),
    );

    expect(store.get(dialogAtom)).toBeNull();
  });

  it("fills the screen for a file embed's full screen view", () => {
    renderModal();
    act(() => store.set(fullscreenAtom, item));

    const dialog = screen.getByRole("dialog", { name: "Plan.docx" });
    expect(isFullScreen(dialog)).toBe(true);
    expect(screen.getAllByText("Plan.docx")).toHaveLength(1);
  });
});
