import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import CodeBlockView from "./code-block-view";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (value: string) => value }),
}));

const editors: Editor[] = [];

function viewProps(
  language: string | null,
  editor: Editor,
  updateAttributes: NodeViewProps["updateAttributes"],
) {
  return {
    node: { attrs: { language }, textContent: "const a = 1;", nodeSize: 14 },
    extension: {
      options: { lowlight: { listLanguages: () => ["python", "javascript"] } },
    },
    editor,
    getPos: () => 0,
    updateAttributes,
  } as unknown as NodeViewProps;
}

function renderView(language: string | null) {
  const editor = new Editor({ extensions: [StarterKit] });
  editors.push(editor);
  const updateAttributes = vi.fn();
  const element = (current: string | null) => (
    <MantineProvider>
      <CodeBlockView {...viewProps(current, editor, updateAttributes)} />
    </MantineProvider>
  );
  const view = render(element(language));

  return {
    updateAttributes,
    select: screen.getByPlaceholderText("auto") as HTMLInputElement,
    setLanguage: (next: string | null) => view.rerender(element(next)),
  };
}

describe("CodeBlockView language select", () => {
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
    })) as unknown as typeof window.matchMedia;
    window.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    cleanup();
    editors.splice(0).forEach((editor) => editor.destroy());
  });

  it("shows the language of the code block", () => {
    const { select } = renderView("javascript");

    expect(select.value).toBe("javascript");
  });

  it("resets the language to auto when the field is left empty", () => {
    const { select, updateAttributes } = renderView("javascript");

    fireEvent.focus(select);
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.blur(select);

    expect(updateAttributes).toHaveBeenCalledTimes(1);
    expect(updateAttributes).toHaveBeenCalledWith({ language: null });
  });

  it("keeps the language when the field is left with a search text", () => {
    const { select, updateAttributes } = renderView("javascript");

    fireEvent.focus(select);
    fireEvent.change(select, { target: { value: "py" } });
    fireEvent.blur(select);

    expect(updateAttributes).not.toHaveBeenCalled();
    expect(select.value).toBe("javascript");
  });

  it("leaves an auto code block alone when the field is left empty", () => {
    const { select, updateAttributes } = renderView(null);

    fireEvent.focus(select);
    fireEvent.blur(select);

    expect(updateAttributes).not.toHaveBeenCalled();
    expect(select.value).toBe("");
  });

  it("follows a language set from outside, such as by a collaborator", () => {
    const { select, setLanguage } = renderView("javascript");

    setLanguage("python");
    expect(select.value).toBe("python");

    setLanguage(null);
    expect(select.value).toBe("");
  });
});
