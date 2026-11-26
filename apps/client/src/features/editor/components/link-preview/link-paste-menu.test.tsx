import { MantineProvider } from "@mantine/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkPasteMenuKey } from "@/features/editor/extensions/link-paste-menu";
import type { LinkPreview } from "@/features/link-preview/types/link-preview.types";
import { queryClient } from "@/main.tsx";
import { LinkPasteMenu } from "./link-paste-menu";
import { LINK_PREVIEW_NODES } from "./link-preview-display";
import { linkPreviewQueryKey } from "./use-link-preview-fill";

const mocks = vi.hoisted(() => ({
  pasteState: null as { from: number; to: number; url: string } | null,
  selectedDisplay: null as Record<string, unknown> | null,
  cardAvailability: vi.fn(),
  convertDisplay: vi.fn(),
  canEmbed: vi.fn(),
  convertEmbed: vi.fn(),
  markPending: vi.fn(),
  getLinkPreview: vi.fn(),
  showNotification: vi.fn(),
  hasFocus: true,
  handlers: {} as Record<string, (props: any) => void>,
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

vi.mock("@/features/editor/extensions/link-paste-menu", () => ({
  linkPasteMenuKey: {
    getState: () => mocks.pasteState,
  },
}));

vi.mock("@/features/editor/utils/link-display", () => ({
  convertLinkDisplay: mocks.convertDisplay,
  getLinkDisplayCardAvailability: mocks.cardAvailability,
  getSelectedLinkDisplay: () => mocks.selectedDisplay,
}));

vi.mock("./link-preview-display", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  canEmbedLink: mocks.canEmbed,
  convertLinkToEmbed: mocks.convertEmbed,
}));

vi.mock("./link-preview-pending", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  markLinkPreviewPending: mocks.markPending,
}));

vi.mock("@/features/link-preview/services/link-preview-service", () => ({
  getLinkPreview: mocks.getLinkPreview,
}));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.showNotification },
}));

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const url = "https://example.com/a";
const otherUrl = "https://example.com/b";
const from = 6;
const to = from + url.length;
const linkSource = { kind: "link", from, to, url, attrs: { url } };
const nodeSource = { kind: "node", pos: 4 };
const preview: LinkPreview = {
  title: "Example title",
  icon: "https://example.com/icon.png",
};

type FakeNode = {
  type: { name: string };
  attrs: Record<string, unknown>;
  nodeSize: number;
};

const linkNode = (name: string, attrs: Record<string, unknown> = {}) => ({
  type: { name },
  attrs: {
    url,
    title: null,
    description: null,
    image: null,
    icon: null,
    ...attrs,
  },
  nodeSize: 1,
});

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderMenu({
  nodeAt = (): FakeNode | null => linkNode("linkCard"),
  editable = true,
} = {}) {
  const tr = {
    setMeta: vi.fn(() => tr),
    setNodeAttribute: vi.fn(() => tr),
  };
  const editor = {
    state: { doc: { nodeAt: vi.fn(nodeAt) }, tr },
    view: {
      dispatch: vi.fn(),
      nodeDOM: vi.fn(),
      hasFocus: () => mocks.hasFocus,
    },
    commands: { focus: vi.fn() },
    isDestroyed: false,
    isEditable: editable,
    on: (name: string, handler: (props: any) => void) => {
      mocks.handlers[name] = handler;
    },
    off: vi.fn(),
  };

  render(
    <MantineProvider>
      <LinkPasteMenu
        editor={
          editor as unknown as ComponentProps<typeof LinkPasteMenu>["editor"]
        }
      />
    </MantineProvider>,
  );

  return editor;
}

const refreshButton = () =>
  screen.getByRole("button", { name: "Refresh preview" });

describe("LinkPasteMenu", () => {
  beforeEach(() => {
    setMediaMatch();
    mocks.pasteState = null;
    mocks.selectedDisplay = null;
    mocks.cardAvailability.mockReset().mockReturnValue({ canUseCard: true });
    mocks.convertDisplay.mockReset().mockReturnValue(true);
    mocks.canEmbed.mockReset().mockReturnValue(true);
    mocks.convertEmbed.mockReset().mockReturnValue(true);
    mocks.markPending.mockReset();
    mocks.getLinkPreview.mockReset();
    mocks.showNotification.mockReset();
    mocks.hasFocus = true;
    mocks.handlers = {};
    queryClient.clear();
  });

  afterEach(cleanup);

  describe("the paste prompt", () => {
    beforeEach(() => {
      mocks.pasteState = { from, to, url };
    });

    it("offers URL, Mention, Card and Embed with URL highlighted", () => {
      renderMenu();

      const prompt = screen.getByRole("listbox", { name: "Paste as" });
      const options = within(prompt).getAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual([
        "URL",
        "Mention",
        "Card",
        "Embed",
      ]);
      expect(
        options.map((option) => option.getAttribute("aria-selected")),
      ).toEqual(["true", "false", "false", "false"]);
      expect(prompt.getAttribute("aria-activedescendant")).toBe(options[0].id);
      expect(screen.queryByRole("toolbar")).toBeNull();
    });

    it("omits Card and Embed where a block can't go", () => {
      mocks.cardAvailability.mockReturnValue({ canUseCard: false });
      mocks.canEmbed.mockReturnValue(false);

      const editor = renderMenu();

      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["URL", "Mention"]);
      expect(mocks.cardAvailability).toHaveBeenCalledWith(
        editor,
        linkSource,
        LINK_PREVIEW_NODES,
      );
      expect(mocks.canEmbed).toHaveBeenCalledWith(editor, linkSource);
    });

    it("Embed is the last option and converts the link to an embed", () => {
      const editor = renderMenu();

      fireEvent.keyDown(window, { key: "ArrowUp" });
      expect(
        screen
          .getByRole("option", { name: "Embed" })
          .getAttribute("aria-selected"),
      ).toBe("true");
      fireEvent.keyDown(window, { key: "Enter" });

      expect(editor.state.tr.setMeta).toHaveBeenCalledWith(
        linkPasteMenuKey,
        null,
      );
      expect(mocks.convertEmbed).toHaveBeenCalledWith(editor, linkSource);
      expect(mocks.convertDisplay).not.toHaveBeenCalled();
      expect(mocks.markPending).not.toHaveBeenCalled();
    });

    it("Enter on URL closes the prompt and keeps the link", () => {
      const editor = renderMenu();

      expect(fireEvent.keyDown(window, { key: "Enter" })).toBe(false);

      expect(editor.state.tr.setMeta).toHaveBeenCalledWith(
        linkPasteMenuKey,
        null,
      );
      expect(editor.view.dispatch).toHaveBeenCalled();
      expect(mocks.markPending).not.toHaveBeenCalled();
      expect(mocks.convertDisplay).not.toHaveBeenCalled();
    });

    it("ArrowDown then Enter converts to a mention", () => {
      const editor = renderMenu();

      fireEvent.keyDown(window, { key: "ArrowDown" });
      expect(
        screen
          .getByRole("option", { name: "Mention" })
          .getAttribute("aria-selected"),
      ).toBe("true");
      fireEvent.keyDown(window, { key: "Enter" });

      expect(editor.state.tr.setMeta).toHaveBeenCalledWith(
        linkPasteMenuKey,
        null,
      );
      expect(mocks.markPending).toHaveBeenCalledWith(editor, url);
      expect(mocks.convertDisplay).toHaveBeenCalledWith(
        editor,
        linkSource,
        "mention",
        LINK_PREVIEW_NODES,
      );
      // The node view only fills a URL marked before it mounts.
      expect(mocks.markPending.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.convertDisplay.mock.invocationCallOrder[0],
      );
    });

    it("clicking Card converts to a card", () => {
      const editor = renderMenu();

      fireEvent.click(screen.getByRole("option", { name: "Card" }));

      expect(mocks.markPending).toHaveBeenCalledWith(editor, url);
      expect(mocks.convertDisplay).toHaveBeenCalledWith(
        editor,
        linkSource,
        "card",
        LINK_PREVIEW_NODES,
      );
    });

    it("Escape closes the prompt", () => {
      const editor = renderMenu();

      expect(fireEvent.keyDown(window, { key: "Escape" })).toBe(false);

      expect(editor.state.tr.setMeta).toHaveBeenCalledWith(
        linkPasteMenuKey,
        null,
      );
      expect(editor.view.dispatch).toHaveBeenCalled();
      expect(mocks.convertDisplay).not.toHaveBeenCalled();
    });

    it("leaves keys alone when focus is outside the editor and the prompt", () => {
      mocks.hasFocus = false;

      const editor = renderMenu();

      expect(screen.getByRole("listbox", { name: "Paste as" })).toBeTruthy();
      expect(fireEvent.keyDown(window, { key: "Enter" })).toBe(true);
      expect(editor.view.dispatch).not.toHaveBeenCalled();
      expect(mocks.convertDisplay).not.toHaveBeenCalled();
    });

    it("dismisses the prompt when the editor loses focus elsewhere", () => {
      const editor = renderMenu();

      mocks.handlers.blur({
        event: new FocusEvent("blur", { relatedTarget: document.body }),
      });

      expect(editor.state.tr.setMeta).toHaveBeenCalledWith(
        linkPasteMenuKey,
        null,
      );
      expect(editor.view.dispatch).toHaveBeenCalled();
    });

    it("keeps the prompt when focus moves into it", () => {
      const editor = renderMenu();

      mocks.handlers.blur({
        event: new FocusEvent("blur", {
          relatedTarget: screen.getByRole("option", { name: "Mention" }),
        }),
      });

      expect(editor.view.dispatch).not.toHaveBeenCalled();
    });
  });

  describe("the toolbar", () => {
    beforeEach(() => {
      mocks.selectedDisplay = { current: "card", source: nodeSource, url };
    });

    it("a selected card shows Display as, Refresh preview and Open link", () => {
      renderMenu();

      const toolbar = screen.getByRole("toolbar", { name: "Link actions" });
      expect(
        within(toolbar).getByRole("radiogroup", { name: "Display as" }),
      ).toBeTruthy();
      expect(
        within(toolbar)
          .getByRole("radio", { name: "Card" })
          .getAttribute("aria-checked"),
      ).toBe("true");
      expect(
        within(toolbar).getByRole("button", { name: "Refresh preview" }),
      ).toBeTruthy();
      const openLink = within(toolbar).getByRole("link", { name: "Open link" });
      expect(openLink.getAttribute("href")).toBe(url);
      expect(openLink.getAttribute("target")).toBe("_blank");
      expect(openLink.getAttribute("rel")).toBe("noopener noreferrer");
      expect(
        within(toolbar).queryByRole("button", { name: "Copy link" }),
      ).toBeNull();
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("a selected mention also offers Copy link", () => {
      mocks.selectedDisplay = { current: "mention", source: nodeSource, url };

      renderMenu({ nodeAt: () => linkNode("linkMention") });

      expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    });

    it("an unsafe URL gets no Open link or Copy link", () => {
      const unsafeUrl = "javascript:alert(1)";
      mocks.selectedDisplay = {
        current: "mention",
        source: nodeSource,
        url: unsafeUrl,
      };

      renderMenu({ nodeAt: () => linkNode("linkMention", { url: unsafeUrl }) });

      const toolbar = screen.getByRole("toolbar", { name: "Link actions" });
      expect(
        within(toolbar).queryByRole("link", { name: "Open link" }),
      ).toBeNull();
      expect(
        within(toolbar).queryByRole("button", { name: "Copy link" }),
      ).toBeNull();
    });

    it("a read-only editor shows no Refresh preview", () => {
      renderMenu({ editable: false });

      expect(screen.getByRole("toolbar", { name: "Link actions" })).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Refresh preview" }),
      ).toBeNull();
    });

    it("switching to a mention keeps the preview and fetches nothing", () => {
      const editor = renderMenu();

      fireEvent.click(screen.getByRole("radio", { name: "Mention" }));

      expect(mocks.convertDisplay).toHaveBeenCalledWith(
        editor,
        nodeSource,
        "mention",
        LINK_PREVIEW_NODES,
      );
      expect(mocks.markPending).not.toHaveBeenCalled();
      expect(mocks.getLinkPreview).not.toHaveBeenCalled();
    });

    it("Refresh preview writes the fresh preview", async () => {
      const request = deferred<LinkPreview | null>();
      mocks.getLinkPreview.mockReturnValue(request.promise);
      const editor = renderMenu({
        nodeAt: () =>
          linkNode("linkCard", {
            title: "Old title",
            description: "Old description",
            image: "https://example.com/old.png",
          }),
      });

      fireEvent.click(refreshButton());

      expect(mocks.getLinkPreview).toHaveBeenCalledWith({ url, refresh: true });
      expect(refreshButton().getAttribute("aria-busy")).toBe("true");
      // Other nodes with this URL keep what they show while it runs.
      expect(queryClient.getQueryState(linkPreviewQueryKey(url))).toBeUndefined();

      await act(async () => request.resolve(preview));

      expect(editor.state.tr.setNodeAttribute.mock.calls).toEqual([
        [4, "description", null],
        [4, "image", null],
        [4, "icon", "https://example.com/icon.png"],
        [4, "title", "Example title"],
      ]);
      expect(editor.view.dispatch).toHaveBeenCalledWith(editor.state.tr);
      // An undoable step: nothing keeps it out of the history.
      expect(editor.state.tr.setMeta).not.toHaveBeenCalled();
      expect(queryClient.getQueryData(linkPreviewQueryKey(url))).toEqual(
        preview,
      );
      expect(refreshButton().getAttribute("aria-busy")).toBeNull();
    });

    it("Refresh preview follows a node that moved during the fetch", async () => {
      const request = deferred<LinkPreview | null>();
      mocks.getLinkPreview.mockReturnValue(request.promise);
      const editor = renderMenu({
        nodeAt: (pos?: number) => (pos === 8 ? linkNode("linkCard") : null),
      });

      fireEvent.click(refreshButton());
      // Someone typed three characters before the card, and a plugin's follow-up added one more.
      mocks.handlers.transaction({
        transaction: { mapping: { map: (pos: number) => pos + 3 } },
        appendedTransactions: [{ mapping: { map: (pos: number) => pos + 1 } }],
      });
      await act(async () => request.resolve(preview));

      expect(editor.state.tr.setNodeAttribute.mock.calls).toEqual([
        [8, "icon", preview.icon],
        [8, "title", preview.title],
      ]);
      expect(editor.off).toHaveBeenCalledWith(
        "transaction",
        mocks.handlers.transaction,
      );
    });

    it("Refresh preview writes nothing into a node that changed during the fetch", async () => {
      mocks.getLinkPreview.mockResolvedValue(preview);
      const editor = renderMenu({
        nodeAt: () => linkNode("linkCard", { url: otherUrl }),
      });

      fireEvent.click(refreshButton());

      await waitFor(() =>
        expect(refreshButton().getAttribute("aria-busy")).toBeNull(),
      );
      expect(editor.state.tr.setNodeAttribute).not.toHaveBeenCalled();
      expect(editor.view.dispatch).not.toHaveBeenCalled();
      expect(mocks.showNotification).not.toHaveBeenCalled();
    });

    it.each([
      ["no preview", () => Promise.resolve(null)],
      ["a failed request", () => Promise.reject(new Error("offline"))],
    ])(
      "a failed refresh shows a notification and leaves the node (%s)",
      async (_, result) => {
        mocks.getLinkPreview.mockImplementation(result);
        const editor = renderMenu();

        fireEvent.click(refreshButton());

        await waitFor(() =>
          expect(mocks.showNotification).toHaveBeenCalledWith({
            message: "Couldn't refresh the preview",
            color: "red",
          }),
        );
        expect(editor.state.tr.setNodeAttribute).not.toHaveBeenCalled();
        expect(editor.view.dispatch).not.toHaveBeenCalled();
        expect(
          queryClient.getQueryState(linkPreviewQueryKey(url)),
        ).toBeUndefined();
        await waitFor(() =>
          expect(refreshButton().getAttribute("aria-busy")).toBeNull(),
        );
      },
    );
  });
});
