import { MantineProvider } from "@mantine/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplatePlaceholder } from "@/features/editor/extensions/template-placeholder";
import { TemplatePlaceholderPopover } from "./template-placeholder-popover";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let editor: Editor;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  editor = new Editor({
    extensions: [
      StarterKit,
      TemplatePlaceholder.configure({ onEdit: vi.fn() }),
    ],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Owner: " },
            {
              type: "templatePlaceholder",
              attrs: { hint: "First name" },
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " next" },
          ],
        },
      ],
    },
  });
  vi.spyOn(editor.view, "coordsAtPos").mockReturnValue({
    left: 10,
    right: 10,
    top: 20,
    bottom: 40,
  });
});

afterEach(() => {
  cleanup();
  editor.destroy();
  vi.unstubAllGlobals();
});

async function openField() {
  render(
    <MantineProvider env="test">
      <TemplatePlaceholderPopover editor={editor} onClose={vi.fn()} />
    </MantineProvider>,
  );
  return await screen.findByRole<HTMLInputElement>("textbox", {
    name: "Placeholder text",
  });
}

describe("template placeholder popover", () => {
  it("keeps a cleared field open when the window loses focus", async () => {
    const onClose = vi.fn();
    editor.commands.setNodeSelection(8);
    render(
      <MantineProvider env="test">
        <TemplatePlaceholderPopover editor={editor} onClose={onClose} />
      </MantineProvider>,
    );
    const field = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Placeholder text",
    });
    fireEvent.change(field, { target: { value: "" } });
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    fireEvent.blur(field);
    expect(onClose).not.toHaveBeenCalled();
    expect(editor.state.doc.firstChild.child(1).attrs.hint).toBe("First name");
  });

  it("saves typed text through saveRef after the popover unmounts", async () => {
    const saveRef = { current: null as (() => void) | null };
    editor.commands.setNodeSelection(8);
    render(
      <MantineProvider env="test">
        <TemplatePlaceholderPopover
          editor={editor}
          onClose={vi.fn()}
          saveRef={saveRef}
        />
      </MantineProvider>,
    );
    const field = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Placeholder text",
    });
    fireEvent.change(field, { target: { value: "Owner's full name" } });
    cleanup();
    saveRef.current?.();
    expect(editor.state.doc.firstChild.child(1).attrs.hint).toBe(
      "Owner's full name",
    );
  });

  it("edits an existing hint in place and opens with the caret at its end", async () => {
    const original = editor.getJSON();
    editor.commands.setNodeSelection(8);
    const field = await openField();
    expect(field.value).toBe("First name");
    expect([field.selectionStart, field.selectionEnd]).toEqual([10, 10]);
    expect(editor.getJSON()).toEqual(original);
    fireEvent.change(field, { target: { value: "Enter a name" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(editor.getJSON().content[0].content).toEqual([
      { type: "text", text: "Owner: " },
      {
        type: "templatePlaceholder",
        attrs: { hint: "Enter a name" },
        marks: [{ type: "bold" }],
      },
      { type: "text", text: " next" },
    ]);
    editor.commands.undo();
    expect(editor.getJSON()).toEqual(original);
  });

  it("leaves the original hint and selection in place on Escape", async () => {
    editor.commands.setNodeSelection(8);
    const original = editor.state.selection;
    const field = await openField();
    fireEvent.change(field, { target: { value: "Different words" } });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(editor.state.doc).toBe(original.$from.doc);
    expect(editor.state.selection.eq(original)).toBe(true);
  });

  it("applies a click-away edit to the original hint after other content moves it", async () => {
    editor.commands.setNodeSelection(8);
    const field = await openField();
    act(() => editor.view.dispatch(editor.state.tr.insertText("New ", 1, 1)));
    fireEvent.change(field, { target: { value: "Name" } });
    fireEvent.pointerDown(document.body);
    expect(editor.state.doc.firstChild.textContent).toBe("New Owner:  next");
    expect(editor.state.doc.firstChild.child(1).attrs.hint).toBe("Name");
  });

  it("inserts a new hint at the caret in an empty heading", async () => {
    editor.commands.setContent("<h2></h2>");
    editor.commands.setTextSelection(1);
    const field = await openField();
    expect(field.value).toBe("");
    fireEvent.change(field, { target: { value: "Outcome" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(editor.state.doc.firstChild.type.name).toBe("heading");
    expect(editor.state.doc.firstChild.firstChild.attrs.hint).toBe("Outcome");
  });
});
