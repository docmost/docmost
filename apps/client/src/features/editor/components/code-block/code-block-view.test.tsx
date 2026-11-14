import { MantineProvider } from "@mantine/core";
import { act, cleanup, render } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodeBlockView from "./code-block-view";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (value: string) => value }),
}));

vi.mock("@/features/editor/components/code-block/mermaid-view.tsx", () => ({
  default: () => null,
}));

const BLOCK_POS = 10;
const BLOCK_SIZE = 20;

function setMediaMatch() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function createEditor() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    isEditable: true,
    state: { selection: { from: 0, to: 0 } },
    on(event: string, listener: () => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
    },
    off(event: string, listener: () => void) {
      listeners.get(event)?.delete(listener);
    },
    listenerCount: (event: string) => listeners.get(event)?.size ?? 0,
    select(from: number, to = from) {
      this.state.selection = { from, to };
      act(() => listeners.get("selectionUpdate")?.forEach((listener) => listener()));
    },
  };
}

function renderView(language: string) {
  const editor = createEditor();
  const getPos = vi.fn(() => BLOCK_POS);
  const view = (nextLanguage: string) => (
    <MantineProvider>
      <CodeBlockView
        {...({
          editor,
          getPos,
          node: {
            attrs: { language: nextLanguage },
            nodeSize: BLOCK_SIZE,
            textContent: "graph TD; A-->B",
          },
          updateAttributes: vi.fn(),
          extension: {
            options: {
              lowlight: { listLanguages: () => ["javascript", "mermaid"] },
            },
          },
        } as unknown as NodeViewProps)}
      />
    </MantineProvider>
  );
  const rendered = render(view(language));

  return {
    editor,
    getPos,
    source: () => rendered.container.querySelector("pre"),
    setLanguage: (next: string) => rendered.rerender(view(next)),
  };
}

describe("CodeBlockView", () => {
  beforeEach(setMediaMatch);
  afterEach(cleanup);

  it("shows the source of a mermaid block only while the selection is in it", () => {
    const { editor, source } = renderView("mermaid");
    expect(source().hidden).toBe(true);

    editor.select(BLOCK_POS + 3);
    expect(source().hidden).toBe(false);

    editor.select(BLOCK_POS + BLOCK_SIZE + 5);
    expect(source().hidden).toBe(true);
  });

  it("shows the source of a mermaid block when the selection ends in it", () => {
    const { editor, source } = renderView("mermaid");

    editor.select(2, BLOCK_POS + 4);

    expect(source().hidden).toBe(false);
  });

  it("keeps the source visible when the block with the caret becomes mermaid", () => {
    const { editor, source, setLanguage } = renderView("javascript");
    editor.select(BLOCK_POS + 3);
    expect(source().hidden).toBe(false);

    setLanguage("mermaid");

    expect(source().hidden).toBe(false);
  });

  it("hides the source when a block without the caret becomes mermaid", () => {
    const { editor, source, setLanguage } = renderView("javascript");
    editor.select(BLOCK_POS + BLOCK_SIZE + 5);

    setLanguage("mermaid");

    expect(source().hidden).toBe(true);
  });

  it("does not follow the selection for other languages", () => {
    const { editor, getPos } = renderView("javascript");
    getPos.mockClear();

    editor.select(BLOCK_POS + 3);

    expect(editor.listenerCount("selectionUpdate")).toBe(0);
    expect(getPos).not.toHaveBeenCalled();
  });
});
