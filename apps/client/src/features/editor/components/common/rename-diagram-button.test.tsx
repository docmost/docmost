import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { Editor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Drawio, Excalidraw } from "@docmost/editor-ext";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import { NodeBubbleMenu } from "../bubble-menu/node-bubble-menu";
import { RenameDiagramButton } from "./rename-diagram-button";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let editor: Editor;
beforeAll(() => {
  window.matchMedia ??= ((media: string) => ({
    media,
    matches: false,
    onchange: null,
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    addEventListener() {},
    removeEventListener() {},
  })) as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  editor?.destroy();
  vi.clearAllMocks();
});

it.each(["drawio", "excalidraw"] as const)(
  "renames the selected %s by ID across its embeds",
  async (type) => {
    const fileName = `Network #1.${type}.svg`;
    vi.mocked(api.post).mockResolvedValue({
      data: { id: "first", fileName, updatedAt: "2026-01-01" },
    });
    const node = (id: string) => ({
      type,
      attrs: {
        attachmentId: id,
        title: `diagram.${type}.svg`,
        src: `/api/files/${id}/diagram.${type}.svg`,
      },
    });
    editor = new Editor({
      extensions: [
        StarterKit,
        Drawio.configure({ resize: { enabled: true } }),
        Excalidraw.configure({ resize: { enabled: true } }),
      ],
      content: {
        type: "doc",
        content: [node("first"), node("second"), node("first")],
      },
    });
    Object.assign(editor.storage, { pageId: "page-1" });
    render(
      <MantineProvider env="test">
        <EditorContent editor={editor} />
        <NodeBubbleMenu
          editor={editor}
          updateDelay={0}
          shouldShow={() => editor.isActive(type)}
          getReferencedVirtualElement={() => editor.view.dom}
        >
          <RenameDiagramButton editor={editor} type={type} />
        </NodeBubbleMenu>
      </MantineProvider>,
    );
    act(() => {
      editor.commands.setNodeSelection(0);
      editor.view.focus();
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Rename diagram" }),
    );
    const input = screen.getByRole("textbox", {
      name: "Name",
    }) as HTMLInputElement;
    expect(input.value).toBe("diagram");
    fireEvent.change(input, { target: { value: "Network #1" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() =>
      expect(editor.state.doc.child(0).attrs.title).toBe(fileName),
    );
    expect(api.post).toHaveBeenCalledWith("/attachments/rename-diagram", {
      attachmentId: "first",
      name: "Network #1",
    });
    expect(editor.state.doc.child(2).attrs.src).toContain(
      `/api/files/first/${encodeURIComponent(fileName)}?`,
    );
    expect(editor.state.doc.child(1).attrs.title).toBe(`diagram.${type}.svg`);
  },
);
