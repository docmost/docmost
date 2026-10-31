import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadFile } from "@/features/page/services/page-service.ts";
import DrawioMenu from "../drawio/drawio-menu";
import DrawioView from "../drawio/drawio-view";
import ExcalidrawMenu from "../excalidraw/excalidraw-menu";
import ExcalidrawView from "../excalidraw/excalidraw-view";

const stubs = vi.hoisted(() => ({
  drawio: null as any,
  excalidraw: null as any,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (value: string) => value }),
}));
vi.mock("@/i18n.ts", () => ({ default: { t: (value: string) => value } }));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("@/features/page/services/page-service.ts", () => ({
  uploadFile: vi.fn(),
}));
vi.mock("@/features/editor/components/common/use-alt-text-control", () => ({
  useAltTextControl: () => ({ button: null, panel: null, isEditing: false }),
}));
vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@tiptap/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tiptap/react")>()),
  useEditorState: () => ({ src: "/api/files/id/d.svg", attachmentId: "id" }),
}));
vi.mock("react-drawio", async () => {
  const { forwardRef } = await import("react");
  return {
    DrawIoEmbed: forwardRef((props: any, _ref) => {
      stubs.drawio = props;
      return <div data-testid="diagram-editor" />;
    }),
  };
});
vi.mock("@excalidraw/excalidraw", async () => {
  const { useEffect } = await import("react");
  return {
    Excalidraw: (props: any) => {
      stubs.excalidraw = props;
      useEffect(() => {
        props.onExcalidrawAPI({ getSceneElements: () => [], getFiles: () => ({}) });
      }, []);
      return <div data-testid="diagram-editor" />;
    },
    useHandleLibrary: () => undefined,
    exportScene: async () =>
      document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    loadFromBlob: async () => ({ elements: [], appState: {}, files: {} }),
  };
});

const SVG = `data:image/svg+xml;base64,${btoa("<svg></svg>")}`;
const SHORTEST_AUTOSAVE_MS = 30_000;

const nodeViewProps = () =>
  ({
    node: { attrs: { attachmentId: "id", src: "" } },
    editor: { isEditable: true, storage: { pageId: "page-id" } },
    updateAttributes: vi.fn(),
    selected: false,
  }) as unknown as NodeViewProps;

const menuEditor = () =>
  ({
    isEditable: true,
    storage: { pageId: "page-id" },
    commands: { updateAttributes: vi.fn() },
  }) as any;

const openFromCard = (text: string) => () =>
  fireEvent.click(screen.getByText(text), { detail: 2 });
const openFromMenu = () =>
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));

const saveDrawio = () =>
  stubs.drawio.onSave({ parentEvent: "save", xml: SVG });
const autosaveDrawio = () => stubs.drawio.onExport({ data: SVG });

const saveExcalidraw = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save & Exit" }));

function autosaveExcalidraw(setIntervalSpy: ReturnType<typeof vi.spyOn>) {
  stubs.excalidraw.onChange([], {}, {});
  stubs.excalidraw.onChange([{ version: 2 }], {}, {});
  const timers = setIntervalSpy.mock.calls.filter(
    ([, delay]) => Number(delay) >= SHORTEST_AUTOSAVE_MS,
  );
  (timers[timers.length - 1][0] as () => void)();
}

const uploadRejected = (message?: string) =>
  Object.assign(new Error("Request failed"), {
    response: { data: message ? { message } : {} },
  });

describe.each([
  {
    name: "DrawioView",
    ui: () => <DrawioView {...nodeViewProps()} />,
    open: openFromCard("Double-click to edit Draw.io diagram"),
    save: saveDrawio,
    autosave: autosaveDrawio,
  },
  {
    name: "DrawioMenu",
    ui: () => <DrawioMenu editor={menuEditor()} />,
    open: openFromMenu,
    save: saveDrawio,
    autosave: autosaveDrawio,
  },
  {
    name: "ExcalidrawView",
    ui: () => <ExcalidrawView {...nodeViewProps()} />,
    open: openFromCard("Double-click to edit Excalidraw diagram"),
    save: saveExcalidraw,
    autosave: autosaveExcalidraw,
  },
  {
    name: "ExcalidrawMenu",
    ui: () => <ExcalidrawMenu editor={menuEditor()} />,
    open: openFromMenu,
    save: saveExcalidraw,
    autosave: autosaveExcalidraw,
  },
])("saving from $name", ({ ui, open, save, autosave }) => {
  let setIntervalSpy: ReturnType<typeof vi.spyOn>;

  async function openEditor() {
    render(<MantineProvider env="test">{ui()}</MantineProvider>);
    open();
    await screen.findByTestId("diagram-editor");
    await act(async () => {
      await new Promise((done) => setTimeout(done));
    });
  }

  beforeEach(() => {
    vi.mocked(uploadFile).mockReset();
    vi.mocked(notifications.show).mockClear();
    setIntervalSpy = vi.spyOn(window, "setInterval");
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: false,
      media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ blob: async () => new Blob([SVG]) })),
    );
  });

  afterEach(() => {
    cleanup();
    setIntervalSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("shows the server's message and keeps the editor open", async () => {
    vi.mocked(uploadFile).mockRejectedValue(
      uploadRejected("File too large. Exceeds the 2mb limit"),
    );
    await openEditor();

    await act(async () => save());

    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith({
        color: "red",
        message: "File too large. Exceeds the 2mb limit",
      }),
    );
    expect(screen.queryByTestId("diagram-editor")).not.toBeNull();
  });

  it("falls back to a general message when the server gives none", async () => {
    vi.mocked(uploadFile).mockRejectedValue(new Error("Network Error"));
    await openEditor();

    await act(async () => save());

    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith({
        color: "red",
        message: "Failed to save diagram",
      }),
    );
  });

  it("stays quiet when an autosave fails", async () => {
    vi.mocked(uploadFile).mockRejectedValue(uploadRejected("Upload failed"));
    await openEditor();

    await act(async () => autosave(setIntervalSpy));

    await waitFor(() => expect(uploadFile).toHaveBeenCalled());
    await act(async () => {
      await new Promise((done) => setTimeout(done));
    });
    expect(notifications.show).not.toHaveBeenCalled();
    expect(screen.queryByTestId("diagram-editor")).not.toBeNull();
  });

  it("closes without an error when the save works", async () => {
    vi.mocked(uploadFile).mockResolvedValue({
      id: "id",
      fileName: "diagram.svg",
      fileSize: 10,
      updatedAt: new Date().toISOString(),
    } as any);
    await openEditor();

    await act(async () => save());

    await waitFor(() =>
      expect(screen.queryByTestId("diagram-editor")).toBeNull(),
    );
    expect(notifications.show).not.toHaveBeenCalled();
  });
});
