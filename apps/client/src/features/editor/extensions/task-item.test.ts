import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-list";
import { TaskItem, canEditDocument } from "./task-item";

let editor: Editor | null = null;
let element: HTMLElement | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  element?.remove();
  element = null;
});

function createEditor({
  editable = true,
  canEdit,
  checked = false,
}: {
  editable?: boolean;
  canEdit?: boolean;
  checked?: boolean;
}) {
  element = document.createElement("div");
  document.body.appendChild(element);

  const content: JSONContent = {
    type: "doc",
    content: [
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Buy milk" }],
              },
            ],
          },
        ],
      },
    ],
  };

  editor = new Editor({
    element,
    editable,
    extensions: [
      StarterKit.configure({
        document: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content,
  });

  if (canEdit !== undefined) {
    (editor.storage as any).canEdit = canEdit;
  }

  return editor;
}

describe("TaskItem extension", () => {
  it("determines edit permissions correctly with canEditDocument", () => {
    const ed = createEditor({ editable: false, canEdit: true });
    expect(canEditDocument(ed)).toBe(true);

    (ed.storage as any).canEdit = false;
    expect(canEditDocument(ed)).toBe(false);

    delete (ed.storage as any).canEdit;
    expect(canEditDocument(ed)).toBe(false);
  });

  it("toggles checked state in edit mode without stealing focus", () => {
    const ed = createEditor({ editable: true, checked: false });
    const checkbox = element!.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);

    // Simulate change
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    const node = ed.state.doc.nodeAt(1); // taskItem
    expect(node?.type.name).toBe("taskItem");
    expect(node?.attrs.checked).toBe(true);
  });

  it("toggles checked state in read mode when user has canEdit permission", () => {
    const ed = createEditor({ editable: false, canEdit: true, checked: false });
    expect(ed.isEditable).toBe(false);

    const checkbox = element!.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.disabled).toBe(false);

    // Toggle in read mode
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    const node = ed.state.doc.nodeAt(1);
    expect(node?.attrs.checked).toBe(true);
  });

  it("prevents toggling when user does not have edit permissions", () => {
    const ed = createEditor({
      editable: false,
      canEdit: false,
      checked: false,
    });
    const checkbox = element!.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.disabled).toBe(true);

    // Attempt to force change event
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    // Should revert back to false and leave doc unchanged
    expect(checkbox.checked).toBe(false);
    const node = ed.state.doc.nodeAt(1);
    expect(node?.attrs.checked).toBe(false);
  });

  it("stops touchstart event propagation to prevent mobile cursor jumps", () => {
    createEditor({ editable: true });
    const label = element!.querySelector("label") as HTMLLabelElement;
    expect(label).not.toBeNull();

    let propagated = false;
    element!.addEventListener("touchstart", () => {
      propagated = true;
    });

    const touchEvent = new Event("touchstart", { bubbles: true });
    label.dispatchEvent(touchEvent);

    expect(propagated).toBe(false);
  });
});
