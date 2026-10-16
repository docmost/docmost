import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationPasteMenu } from "./integration-paste-menu";

const mocks = vi.hoisted(() => ({
  pasteState: null as {
    pos: number;
    joinBefore?: boolean;
    joinAfter?: boolean;
  } | null,
  selectedDisplay: null as Record<string, unknown> | null,
  convertDisplay: vi.fn(),
  hasFocus: true,
  blurHandler: null as ((props: { event: FocusEvent }) => void) | null,
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

vi.mock("@/features/editor/extensions/integration-paste-menu", () => ({
  integrationPasteMenuKey: {
    getState: () => mocks.pasteState,
  },
}));

vi.mock("./integration-display", () => ({
  convertIntegrationDisplay: mocks.convertDisplay,
  getIntegrationCardAvailability: () => ({ canUseCard: true }),
  getSelectedIntegrationDisplay: () => mocks.selectedDisplay,
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

function renderMenu(nodeType = "integrationCard") {
  const editor = {
    state: {
      doc: {
        nodeAt: () => ({
          type: { name: nodeType },
          attrs: {
            url: "https://gitlab.com/gitlab-org/gitlab/-/issues/609576",
          },
          nodeSize: 1,
        }),
      },
      tr: { setMeta: vi.fn() },
    },
    view: {
      dispatch: vi.fn(),
      nodeDOM: vi.fn(),
      hasFocus: () => mocks.hasFocus,
    },
    commands: { focus: vi.fn() },
    isDestroyed: false,
    on: (name: string, handler: (props: { event: FocusEvent }) => void) => {
      if (name === "blur") mocks.blurHandler = handler;
    },
    off: vi.fn(),
  };

  render(
    <MantineProvider>
      <IntegrationPasteMenu
        editor={
          editor as unknown as ComponentProps<
            typeof IntegrationPasteMenu
          >["editor"]
        }
      />
    </MantineProvider>,
  );

  return editor;
}

describe("IntegrationPasteMenu", () => {
  beforeEach(() => {
    setMediaMatch();
    mocks.pasteState = null;
    mocks.selectedDisplay = null;
    mocks.convertDisplay.mockReset();
    mocks.hasFocus = true;
    mocks.blurHandler = null;
  });

  afterEach(cleanup);

  it("shows the original vertical Paste as chooser only for a fresh paste", () => {
    mocks.pasteState = { pos: 4 };

    renderMenu();

    const chooser = screen.getByRole("listbox", { name: "Paste as" });
    expect(chooser).toBeTruthy();
    expect(chooser.getAttribute("aria-orientation")).toBe("vertical");
    expect(screen.getByRole("option", { name: "Card" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Mention" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "URL" })).toBeTruthy();
    expect(
      screen.queryByRole("toolbar", { name: "Integration link actions" }),
    ).toBeNull();
  });

  it("keeps the horizontal display toolbar for an existing node", () => {
    mocks.selectedDisplay = {
      current: "mention",
      source: { kind: "node", pos: 4 },
      url: "https://gitlab.com/gitlab-org/gitlab/-/issues/609576",
    };

    renderMenu("integrationMention");

    expect(
      screen.getByRole("toolbar", { name: "Integration link actions" }),
    ).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Display as" })).toBeTruthy();
    expect(screen.queryByRole("listbox", { name: "Paste as" })).toBeNull();
  });

  it("handles Paste as keys while the editor has focus", () => {
    mocks.pasteState = { pos: 4 };

    renderMenu();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(mocks.convertDisplay).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "node", pos: 4 },
      "mention",
    );
  });

  it("hands the paste split to the conversion so the sentence can rejoin", () => {
    mocks.pasteState = { pos: 4, joinBefore: true, joinAfter: false };

    renderMenu();
    fireEvent.click(screen.getByRole("option", { name: "URL" }));

    expect(mocks.convertDisplay).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "node", pos: 4, joinBefore: true, joinAfter: false },
      "url",
    );
  });

  it("leaves keys alone when focus is outside the editor and the prompt", () => {
    mocks.pasteState = { pos: 4 };
    mocks.hasFocus = false;

    renderMenu();
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      cancelable: true,
    });
    window.dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(false);
    expect(mocks.convertDisplay).not.toHaveBeenCalled();
  });

  it("dismisses the prompt when the editor loses focus elsewhere", () => {
    mocks.pasteState = { pos: 4 };

    const editor = renderMenu();
    mocks.blurHandler?.({
      event: new FocusEvent("blur", { relatedTarget: document.body }),
    });

    expect(editor.state.tr.setMeta).toHaveBeenCalledWith(expect.anything(), null);
    expect(editor.view.dispatch).toHaveBeenCalled();
  });

  it("keeps the prompt when focus moves into it", () => {
    mocks.pasteState = { pos: 4 };

    const editor = renderMenu();
    mocks.blurHandler?.({
      event: new FocusEvent("blur", {
        relatedTarget: screen.getByRole("option", { name: "Card" }),
      }),
    });

    expect(editor.view.dispatch).not.toHaveBeenCalled();
  });
});
