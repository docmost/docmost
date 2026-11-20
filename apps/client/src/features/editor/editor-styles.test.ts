import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

const editors: Editor[] = [];
const stylesheet = () =>
  document.head.querySelector("style[data-tiptap-style]");

function mountEditor(element: HTMLElement, injectCSS = true) {
  const editor = new Editor({ element, extensions: [StarterKit], injectCSS });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.replaceChildren();
});

describe("shared editor styles", () => {
  it("keeps the same stylesheet while switching to an editor created offscreen", () => {
    const oldPage = document.body.appendChild(document.createElement("div"));
    const outgoing = mountEditor(oldPage);
    const originalStyle = stylesheet();
    const nextPage = document.createElement("div");
    const preview = mountEditor(nextPage);

    expect(originalStyle).not.toBeNull();
    outgoing.destroy();
    expect(stylesheet()).toBe(originalStyle);

    document.body.replaceChildren(nextPage);
    const live = mountEditor(document.createElement("div"));
    preview.destroy();
    expect(stylesheet()).toBe(originalStyle);

    live.destroy();
    expect(stylesheet()).toBeNull();
  });

  it("releases the stylesheet once per mount and only for editors that requested it", () => {
    const host = document.body.appendChild(document.createElement("div"));
    const editor = mountEditor(host);
    mountEditor(host, false);

    editor.unmount();
    expect(stylesheet()).toBeNull();

    editor.mount(host);
    const remountedStyle = stylesheet();
    expect(remountedStyle).not.toBeNull();
    const next = mountEditor(document.createElement("div"));
    editor.unmount();
    editor.unmount();
    expect(stylesheet()).toBe(remountedStyle);

    next.destroy();
    expect(stylesheet()).toBeNull();
  });
});
