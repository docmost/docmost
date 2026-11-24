import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useRef, useState } from "react";
import { MantineProvider } from "@mantine/core";
import type { NodeViewProps } from "@tiptap/react";
import { uploadFile } from "@/features/page/services/page-service.ts";
import {
  writeDiagramDraft,
  discardDiagramDraft,
  readDiagramDraft,
} from "@/features/attachments/services/diagram-service";
import DrawioView from "./drawio-view";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// the real one starts loading locale files over HTTP
vi.mock("@/i18n.ts", () => ({ default: { t: (key: string) => key } }));

vi.mock("@/features/page/services/page-service.ts", () => ({
  uploadFile: vi.fn(),
}));

vi.mock("@/features/attachments/services/diagram-service", () => ({
  writeDiagramDraft: vi.fn(() => Promise.resolve()),
  discardDiagramDraft: vi.fn(() => Promise.resolve()),
  readDiagramDraft: vi.fn(() => Promise.resolve(null)),
}));

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10px" height="10px"><g/></svg>';
const exported = `data:image/svg+xml;base64,${btoa(svg)}`;

// the two exports the draw.io frame reports: one the autosave timer asked for, one for Save & Exit
const autosaveExport = { event: "export", data: exported, message: {} };
const saveAndExitExport = {
  event: "export",
  data: exported,
  message: { parentEvent: "save", exit: true },
};

const attachment = {
  id: "att-1",
  fileName: "Architecture_100%_café.svg",
  fileSize: 10,
  updatedAt: "2026-01-01T00:00:00.000Z",
} as Awaited<ReturnType<typeof uploadFile>>;

const onPage = {
  isEditable: true,
  storage: { pageId: "page-1" },
  state: { doc: { descendants: () => {} } },
};
const updateAttributes = vi.fn();

// stands in for the node view: saved attributes come back as the node's attrs
function Host({
  editor,
  initial = {},
}: {
  editor: typeof onPage | any;
  initial?: Record<string, unknown>;
}) {
  const [attrs, setAttrs] = useState<Record<string, unknown>>(initial);
  const node = { type: { name: "drawio" }, attrs };
  const currentNode = useRef(node);
  currentNode.current = node;
  const tr = {
    saved: {} as Record<string, unknown>,
    setNodeAttribute(_pos: number, key: string, value: unknown) {
      this.saved[key] = value;
      return this;
    },
  };
  const props = {
    node,
    selected: false,
    getPos: () => 0,
    editor: {
      ...editor,
      state: {
        ...editor.state,
        tr,
        doc: {
          ...editor.state?.doc,
          nodeAt: () => currentNode.current,
          content: { size: 1 },
        },
      },
      view: {
        dispatch: (transaction: typeof tr) => {
          updateAttributes(transaction.saved);
          setAttrs((current) => ({ ...current, ...transaction.saved }));
        },
      },
    },
  } as unknown as NodeViewProps;

  return (
    <MantineProvider env="test">
      <DrawioView {...props} />
    </MantineProvider>
  );
}

const openNameDialog = () =>
  fireEvent.click(screen.getByText("Double-click to edit Draw.io diagram"), {
    detail: 2,
  });

const openEditor = (name?: string) => {
  openNameDialog();
  const input = screen.getByRole("textbox", { name: "Name" });
  if (name) fireEvent.change(input, { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
};

const diagramEditor = () => document.querySelector("iframe.diagrams-iframe");

// what the draw.io frame posts to the page
const fromDrawio = (message: object) =>
  act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify(message),
        origin: "https://embed.diagrams.net",
      }),
    );
  });

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
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("a draw.io diagram that has not been saved yet", () => {
  it("opens its editor on a page", async () => {
    render(<Host editor={onPage} />);

    openEditor();

    await waitFor(() => expect(diagramEditor()).not.toBeNull());
  });

  it("accepts a name when the page ID becomes available after the initial render", () => {
    const storage: { pageId?: string } = {};
    render(<Host editor={{ ...onPage, storage }} />);
    storage.pageId = "page-1";
    fireEvent.click(screen.getByRole("button", { name: "Edit diagram" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });

  it("does not open its editor where there is no page to save to", () => {
    render(<Host editor={{ isEditable: true, storage: {} }} />);

    openNameDialog();

    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(diagramEditor()).toBeNull();
  });

  it("autosaves twice to one private draft without publishing a file or changing the preview", async () => {
    render(<Host editor={onPage} />);
    openEditor("Architecture 100% café");
    await waitFor(() => expect(diagramEditor()).not.toBeNull());
    for (let i = 0; i < 2; i++) {
      await fromDrawio({ event: "autosave" });
      await fromDrawio(autosaveExport);
      await waitFor(() =>
        expect(writeDiagramDraft).toHaveBeenCalledTimes(i + 1),
      );
    }
    const [[first, file], [second]] = vi.mocked(writeDiagramDraft).mock.calls;
    expect(first).toEqual({
      pageId: "page-1",
      type: "drawio",
      draftId: expect.any(String),
    });
    expect(second).toEqual(first);
    expect(file.name).toBe("Architecture 100% café.drawio.svg");
    expect(uploadFile).not.toHaveBeenCalled();
    expect(updateAttributes).not.toHaveBeenCalledWith(
      expect.objectContaining({ attachmentId: expect.anything() }),
    );
  });

  it("suggests an unused name across both diagram types and catches a duplicate", () => {
    const doc = {
      descendants: (visit: (node: object) => void) => {
        visit({
          type: { name: "excalidraw" },
          attrs: { title: "Drawio diagram.excalidraw.svg" },
        });
      },
    };
    render(<Host editor={{ ...onPage, state: { doc } }} />);
    openNameDialog();
    const input = screen.getByRole("textbox", {
      name: "Name",
    }) as HTMLInputElement;
    expect(input.value).toBe("Drawio diagram 2");
    fireEvent.change(input, { target: { value: "drawio diagram" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByText("A diagram on this page already uses this name."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(diagramEditor()).toBeNull();
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("uploads once for one Save & Exit", async () => {
    vi.mocked(uploadFile).mockResolvedValue(attachment);
    render(<Host editor={onPage} />);
    openEditor();

    await waitFor(() => expect(diagramEditor()).not.toBeNull());
    await fromDrawio(saveAndExitExport);
    await waitFor(() => expect(diagramEditor()).toBeNull());

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(updateAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        src: "/api/files/att-1/Architecture_100%25_caf%C3%A9.svg",
        title: attachment.fileName,
      }),
    );
  });

  it("saves a Save & Exit that arrives while an autosave is still uploading", async () => {
    let checkpoint!: () => void;
    vi.mocked(writeDiagramDraft).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          checkpoint = resolve;
        }),
    );
    vi.mocked(uploadFile).mockResolvedValue(attachment);
    render(<Host editor={onPage} />);
    openEditor();
    await waitFor(() => expect(diagramEditor()).not.toBeNull());
    await fromDrawio({ event: "autosave" });
    await fromDrawio(autosaveExport);
    await waitFor(() => expect(writeDiagramDraft).toHaveBeenCalledOnce());
    await fromDrawio(saveAndExitExport);
    expect(uploadFile).not.toHaveBeenCalled();
    await act(async () => checkpoint());
    await waitFor(() => expect(diagramEditor()).toBeNull());
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(vi.mocked(uploadFile).mock.calls[0][2]).toEqual({
      type: "drawio",
      previousAttachmentId: undefined,
    });
    expect(discardDiagramDraft).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "opens a published diagram with a recovered draft = %s",
    async (recovered) => {
      const original = new Blob([svg], { type: "image/svg+xml" });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, blob: async () => original })),
      );
      vi.mocked(readDiagramDraft).mockResolvedValueOnce(
        recovered ? original : null,
      );
      vi.mocked(uploadFile).mockResolvedValue(attachment);
      render(
        <Host
          editor={onPage}
          initial={{
            attachmentId: "original",
            draftId: "my-diagram",
            title: "Network.drawio.svg",
            src: "/api/files/original/Network.drawio.svg",
          }}
        />,
      );
      openEditor();
      await waitFor(() => expect(diagramEditor()).not.toBeNull());
      await fromDrawio(saveAndExitExport);
      await waitFor(() => expect(diagramEditor()).toBeNull());
      expect(uploadFile).toHaveBeenCalledTimes(recovered ? 1 : 0);
      expect(readDiagramDraft).toHaveBeenCalledWith({
        pageId: "page-1",
        type: "drawio",
        draftId: "my-diagram",
      });
      if (recovered)
        expect(
          vi.mocked(uploadFile).mock.calls[0][2]?.previousAttachmentId,
        ).toBe("original");
    },
  );
});
