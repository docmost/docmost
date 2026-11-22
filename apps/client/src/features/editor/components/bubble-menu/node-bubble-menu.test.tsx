import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Editor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, expect, it } from "vitest";
import { NodeBubbleMenu } from "./node-bubble-menu";

let editor: Editor;

afterEach(() => {
  cleanup();
  editor?.destroy();
});

it.each([
  ["blockquote", "<blockquote><p>Welcome</p></blockquote>"],
  ["horizontalRule", "<hr>"],
])(
  "shows the first %s menu only when the body has focus",
  async (node, html) => {
    editor = new Editor({
      extensions: [StarterKit],
      content: html + "<p>After</p>",
    });
    render(
      <>
        <input aria-label="Page title" autoFocus />
        <EditorContent editor={editor} />
        <NodeBubbleMenu
          editor={editor}
          updateDelay={0}
          shouldShow={({ editor }) => editor.isActive(node)}
          getReferencedVirtualElement={() => editor.view.dom}
        >
          <button>Block actions</button>
        </NodeBubbleMenu>
      </>,
    );
    const title = screen.getByRole("textbox", { name: "Page title" });
    const actions = () =>
      screen.queryByRole("button", { name: "Block actions" });
    const appendParagraph = () => {
      const { doc, schema, tr } = editor.state;
      editor.view.dispatch(
        tr.insert(doc.content.size, schema.nodes.paragraph.create()),
      );
    };

    expect(document.activeElement).toBe(title);
    expect(editor.isActive(node)).toBe(true);
    expect(actions()).toBeNull();
    act(appendParagraph);
    expect(actions()).toBeNull();

    act(() => editor.view.focus());
    const button = await screen.findByRole("button", { name: "Block actions" });
    act(() => button.focus());
    act(appendParagraph);
    expect(actions()).toBe(button);
    expect(document.activeElement).toBe(button);

    act(() => editor.view.focus());
    act(() => title.focus());
    await waitFor(() => expect(actions()).toBeNull());
  },
);
