import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Heading, UniqueID } from "@docmost/editor-ext";
import { within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

let editor: Editor;

function renderHeading(editable: boolean, id: string | null = "numbers") {
  editor = new Editor({
    element: document.createElement("div"),
    editable,
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading,
      UniqueID.configure({ types: ["heading"], updateDocument: editable }),
    ],
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, id },
          content: [{ type: "text", text: "Numbers" }],
        },
      ],
    },
  });
  return within(editor.view.dom);
}

afterEach(() => {
  editor.destroy();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(document, "execCommand");
});

it.each([true, false])("confirms and resets the heading link tooltip (editable=%s)", async (editable) => {
  vi.useFakeTimers();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const heading = renderHeading(editable);
  const button = heading.getByRole("button", { name: "Copy link to heading" });

  button.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(writeText).toHaveBeenCalledWith(new URL("#numbers", window.location.href).href);
  expect(heading.getByRole("button", { name: "Link copied" })).toBe(button);

  await vi.advanceTimersByTimeAsync(2000);
  expect(heading.getByRole("button", { name: "Copy link to heading" })).toBe(button);
});

it("does not offer an anchor link for a heading without an ID", () => {
  expect(renderHeading(false, null).queryByRole("button")).toBeNull();
});

it("keeps the copy prompt when the browser refuses the clipboard write", async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, "execCommand", { configurable: true, value: () => false });
  const heading = renderHeading(false);
  const button = heading.getByRole("button", { name: "Copy link to heading" });

  button.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(heading.getByRole("button", { name: "Copy link to heading" })).toBe(button);
});
