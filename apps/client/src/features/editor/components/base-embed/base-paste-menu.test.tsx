import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BasePasteMenu } from "./base-paste-menu";

const mocks = vi.hoisted(() => ({
  pasteState: null as { pos: number } | null,
  hasBases: true,
  convert: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value: string) => value }),
}));

vi.mock("@tiptap/react", () => ({
  posToDOMRect: vi.fn(),
  useEditorState: ({ editor, selector }: Record<string, any>) =>
    selector({ editor }),
}));

vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/features/editor/extensions/base-paste-menu", () => ({
  basePasteMenuKey: { getState: () => mocks.pasteState },
}));

vi.mock("@/ee/hooks/use-feature", () => ({
  useHasFeature: () => mocks.hasBases,
}));

vi.mock("./convert-mention-to-base-embed", () => ({
  convertMentionToBaseEmbed: mocks.convert,
}));

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

function renderMenu() {
  const editor = {
    state: {
      doc: { nodeAt: () => ({ type: { name: "mention" }, nodeSize: 1 }) },
      tr: { setMeta: vi.fn() },
    },
    view: { dispatch: vi.fn(), nodeDOM: vi.fn(), hasFocus: () => true },
    commands: { focus: vi.fn() },
    isDestroyed: false,
    on: vi.fn(),
    off: vi.fn(),
  };

  render(
    <MantineProvider>
      <BasePasteMenu
        editor={
          editor as unknown as ComponentProps<typeof BasePasteMenu>["editor"]
        }
      />
    </MantineProvider>,
  );

  return editor;
}

describe("BasePasteMenu", () => {
  beforeEach(() => {
    setMediaMatch();
    mocks.pasteState = { pos: 3 };
    mocks.hasBases = true;
    mocks.convert.mockReset();
  });

  afterEach(cleanup);

  it("embeds the pasted base when its option is clicked", () => {
    const editor = renderMenu();

    fireEvent.click(screen.getByRole("option", { name: "Inline base" }));

    expect(mocks.convert).toHaveBeenCalledWith(editor, 3);
  });

  it("leaves Enter to the editor until the option is highlighted", () => {
    const editor = renderMenu();

    expect(fireEvent.keyDown(window, { key: "Enter" })).toBe(true);
    expect(mocks.convert).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(fireEvent.keyDown(window, { key: "Enter" })).toBe(false);
    expect(mocks.convert).toHaveBeenCalledWith(editor, 3);
  });

  it("closes on Escape and keeps the mention", () => {
    const editor = renderMenu();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(editor.view.dispatch).toHaveBeenCalled();
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  it("stays hidden without the Bases feature", () => {
    mocks.hasBases = false;
    renderMenu();

    expect(screen.queryByRole("option")).toBeNull();
  });
});
