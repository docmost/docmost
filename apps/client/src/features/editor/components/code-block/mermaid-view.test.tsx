import { MantineProvider } from "@mantine/core";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MermaidView from "./mermaid-view";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (value: string) => value }),
}));

const validSource = "flowchart TD\n  A[Start] --> B[Finish]";
const updatedSource = "flowchart TD\n  A[Start] --> C[Review]";
const invalidSource = "flowchart TD\n  A[Start --> B";
const classSource = "classDiagram\n  class Space\n  class Page\n  Space --> Page";
const pieSource = 'pie title Pages\n  "Docs" : 3\n  "Specs" : 2';

const editors: Editor[] = [];

function viewProps(source: string, editor: Editor) {
  return { node: { textContent: source }, editor } as unknown as NodeViewProps;
}

function renderView(source: string, editable = true) {
  const editor = new Editor({ extensions: [StarterKit], editable });
  editors.push(editor);
  const view = render(
    <MantineProvider>
      <MermaidView props={viewProps(source, editor)} />
    </MantineProvider>,
  );

  return {
    container: view.container,
    editor,
    setSource: (next: string) =>
      view.rerender(
        <MantineProvider>
          <MermaidView props={viewProps(next, editor)} />
        </MantineProvider>,
      ),
  };
}

function visibleText(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll("[hidden], style")
    .forEach((invisible) => invisible.remove());
  return clone.textContent;
}

function diagramText(element: HTMLElement) {
  const svg = element.querySelector("svg");
  return svg && !svg.closest("[hidden]") ? svg.textContent : "";
}

describe("MermaidView", () => {
  beforeEach(() => {
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
    // jsdom has no layout or canvas; Pele skips redraws in zero-width containers.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return this.closest("[hidden]") ? 0 : 600;
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    editors.splice(0).forEach((editor) => editor.destroy());
    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
    vi.restoreAllMocks();
  });

  it("draws the diagram once its type has loaded", async () => {
    const { container } = renderView(validSource);

    await waitFor(() => expect(diagramText(container)).toContain("Start"));
  });

  it("redraws the diagram when the source changes", async () => {
    const view = renderView(validSource);
    await waitFor(() => expect(diagramText(view.container)).toContain("Start"));

    view.setSource(updatedSource);

    await waitFor(() => expect(diagramText(view.container)).toContain("Review"));
  });

  it("switches to a diagram type that has not loaded yet", async () => {
    const view = renderView(validSource);
    await waitFor(() => expect(diagramText(view.container)).toContain("Start"));

    view.setSource(classSource);

    await waitFor(() => expect(diagramText(view.container)).toContain("Space"));
    expect(visibleText(view.container)).not.toContain("not supported");
  });

  it("renders nothing while the source is empty", () => {
    const { container } = renderView("");

    expect(visibleText(container)).toBe("");
  });

  it("removes the diagram when the source is cleared", async () => {
    const view = renderView(validSource);
    await waitFor(() => expect(diagramText(view.container)).toContain("Start"));

    view.setSource("");

    expect(visibleText(view.container)).toBe("");
  });

  it("shows editors the parse error", async () => {
    const { container } = renderView(invalidSource);

    await waitFor(() =>
      expect(visibleText(container)).toContain("Parse error on line"),
    );
  });

  it("keeps the last diagram under the error when an edit breaks it", async () => {
    const view = renderView(validSource);
    await waitFor(() => expect(diagramText(view.container)).toContain("Start"));

    view.setSource(invalidSource);

    await waitFor(() =>
      expect(visibleText(view.container)).toContain("Parse error on line"),
    );
    expect(diagramText(view.container)).toContain("Start");
  });

  it("shows readers a generic message instead of the parse error", async () => {
    const { container } = renderView(invalidSource, false);

    await waitFor(() =>
      expect(visibleText(container)).toBe("Invalid Mermaid diagram"),
    );
  });

  it("does not flag a reader's diagram as invalid while its type loads", async () => {
    const { container } = renderView(pieSource, false);

    expect(visibleText(container)).not.toContain("Invalid Mermaid diagram");
    await waitFor(() => expect(diagramText(container)).toContain("Docs"));
  });

  it("shows readers the diagram again once the source is fixed", async () => {
    const view = renderView(validSource, false);
    await waitFor(() => expect(diagramText(view.container)).toContain("Start"));

    view.setSource(invalidSource);
    await waitFor(() =>
      expect(visibleText(view.container)).toBe("Invalid Mermaid diagram"),
    );
    view.setSource(validSource);

    await waitFor(() => expect(diagramText(view.container)).toContain("Start"));
    expect(visibleText(view.container)).not.toContain("Invalid Mermaid diagram");
  });

  describe("zoom controls", () => {
    beforeEach(() => {
      // Draw every diagram at half its natural size, as if shrunk to fit the page.
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
          const width = Number(this.getAttribute("width")) / 2 || 0;
          const height = Number(this.getAttribute("height")) / 2 || 0;
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: width,
            bottom: height,
            width,
            height,
            toJSON: () => ({}),
          } as DOMRect;
        },
      );
    });

    it("gives readers zoom controls for a diagram shrunk to fit", async () => {
      renderView(validSource, false);

      expect(
        await screen.findByRole("button", { name: "Zoom in" }),
      ).toBeTruthy();
    });

    it("keeps zoom controls out of the editor", async () => {
      const { container } = renderView(validSource, true);
      await waitFor(() => expect(diagramText(container)).toContain("Start"));

      expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    });

    it("removes zoom controls when the page switches to edit mode", async () => {
      const view = renderView(validSource, false);
      await screen.findByRole("button", { name: "Zoom in" });

      act(() => view.editor.setEditable(true));

      expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    });
  });
});
