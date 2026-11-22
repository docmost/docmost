import { cleanup, renderHook } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEditorScroll } from "./use-editor-scroll";

const root: HTMLElement = document.createElement("div");
const editor = { view: { dom: root }, isDestroyed: false } as Editor;
const scrollIntoView = vi.fn();

function mount(visible = true) {
  return renderHook(
    ({ visible }) => useEditorScroll(editor, visible),
    {
      initialProps: { visible },
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/manual#rollback"]}>{children}</MemoryRouter>
      ),
    },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("CSS", { escape: (id: string) => id });
  document.body.append(root);
});

afterEach(() => {
  cleanup();
  root.replaceChildren();
  root.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("scrolls to the route's heading when the visible editor is ready", () => {
  const heading = document.createElement("h2");
  heading.id = "rollback";
  heading.scrollIntoView = scrollIntoView;
  root.append(heading);

  const { rerender } = mount(false);
  expect(scrollIntoView).not.toHaveBeenCalled();
  rerender({ visible: true });
  expect(scrollIntoView).toHaveBeenCalledOnce();
});

it.each([
  ["paragraph", '<p data-id="rollback">⚓</p>'],
  [
    "inline",
    '<p>Before <span data-type="section-anchor" data-id="rollback" id="rollback"></span>after</p>',
  ],
])("finds a %s bookmark that appears after the editor mounts", (_, html) => {
  mount();
  root.innerHTML = html;
  const anchor = root.querySelector<HTMLElement>('[data-id="rollback"]')!;
  anchor.scrollIntoView = scrollIntoView;

  vi.advanceTimersByTime(1000);
  expect(scrollIntoView).toHaveBeenCalledOnce();
});

it("opens a heading by its alternate section anchor", () => {
  const heading = document.createElement("h2");
  heading.scrollIntoView = scrollIntoView;
  const alias = document.createElement("span");
  alias.dataset.type = "section-anchor";
  alias.dataset.id = "rollback";
  alias.scrollIntoView = vi.fn();
  heading.append(alias, "Restore service");
  root.append(heading);

  mount();
  expect(scrollIntoView).toHaveBeenCalledOnce();
});
