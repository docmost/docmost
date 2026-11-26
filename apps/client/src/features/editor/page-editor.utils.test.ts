import { Editor } from "@tiptap/core";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { syncEditable } from "@/features/editor/page-editor.utils";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const content = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: ["Name", "Status"].map((text) => ({
            type: "tableHeader",
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          })),
        },
      ],
    },
    {
      type: "image",
      attrs: { src: "/api/files/image-id/image.png", width: 400, height: 300 },
    },
  ],
};

const editors: Editor[] = [];

// The page editor mounts read-only until its document has synced.
function mount(editable: boolean) {
  const editor = new Editor({
    element: document.body.appendChild(document.createElement("div")),
    extensions: mainExtensions,
    content,
    editable,
  });
  editors.push(editor);
  return editor;
}

const pluginNames = (editor: Editor) =>
  editor.state.plugins
    .map((plugin) => (plugin as unknown as { key: string }).key.replace(/\$\d*$/, ""))
    .sort();

const resizeHandles = (editor: Editor) =>
  editor.view.dom.querySelectorAll("[data-resize-handle]").length;

beforeAll(() => {
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("ResizeObserver", NoopObserver);
  vi.stubGlobal("IntersectionObserver", NoopObserver);
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.replaceChildren();
});

it("gives a page that becomes editable after mounting the same plugins as one that starts editable", () => {
  const editableFromStart = mount(true);
  const synced = mount(false);
  syncEditable(synced, true);

  expect(pluginNames(synced)).toEqual(pluginNames(editableFromStart));
});

it("shows media resize handles once the page becomes editable and hides them in read mode", () => {
  const editor = mount(false);

  syncEditable(editor, true);
  expect(resizeHandles(editor)).toBeGreaterThan(0);

  syncEditable(editor, false);
  expect(resizeHandles(editor)).toBe(0);
});
