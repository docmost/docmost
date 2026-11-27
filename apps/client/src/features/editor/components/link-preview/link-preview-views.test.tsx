import { LinkCard, LinkMention } from "@docmost/editor-ext";
import { MantineProvider } from "@mantine/core";
import {
  defaultScheduler,
  notifyManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import TiptapLink from "@tiptap/extension-link";
import { NodeSelection } from "@tiptap/pm/state";
import { Editor, EditorContent, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { createStore, Provider } from "jotai";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { convertLinkDisplay } from "@/features/editor/utils/link-display";
import { getLinkPreview } from "@/features/link-preview/services/link-preview-service";
import type { LinkPreview } from "@/features/link-preview/types/link-preview.types";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import type { ICurrentUser } from "@/features/user/types/user.types";
import LinkCardView from "./link-card-view";
import { LINK_PREVIEW_NODES } from "./link-preview-display";
import {
  isLinkPreviewPending,
  LINK_PREVIEW_PENDING_TTL_MS,
  markLinkPreviewPending,
} from "./link-preview-pending";
import LinkMentionView from "./link-mention-view";
import { LinkPasteMenu } from "./link-paste-menu";

vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("@/features/link-preview/services/link-preview-service", () => ({
  getLinkPreview: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const url = "https://example.com/a";
const otherUrl = "https://example.com/b";
const unsafeUrl = "javascript:alert(1)";
const preview: LinkPreview = {
  title: "Example title",
  description: "Example description",
  image: "https://example.com/image.png",
  icon: "https://example.com/icon.png",
};

const text = (value: string, marks?: JSONContent["marks"]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks && { marks }),
});
const paragraph = (...content: JSONContent[]): JSONContent => ({
  type: "paragraph",
  ...(content.length && { content }),
});
const card = (attrs: Record<string, unknown>): JSONContent => ({
  type: "linkCard",
  attrs,
});
const mention = (attrs: Record<string, unknown>): JSONContent => ({
  type: "linkMention",
  attrs,
});

const editors: Editor[] = [];

function show(
  content: JSONContent[],
  { editable = true, loggedIn = true } = {},
) {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ link: false }),
      TiptapLink,
      LinkCard.configure({ view: LinkCardView }),
      LinkMention.configure({ view: LinkMentionView }),
    ],
    editable,
    content: { type: "doc", content },
  });
  editors.push(editor);

  const store = createStore();
  if (loggedIn) {
    store.set(currentUserAtom, { user: { id: "user-1" } } as ICurrentUser);
  }
  // Like the app's client; the hook sets its own retry and staleTime.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { refetchOnMount: false, refetchOnWindowFocus: false },
    },
  });
  render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider env="test">
          <EditorContent editor={editor} />
        </MantineProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return editor;
}

const allCardAttrs = (editor: Editor) =>
  (editor.getJSON().content ?? [])
    .filter((node) => node.type === "linkCard")
    .map((node) => node.attrs);
const cardAttrs = (editor: Editor) => allCardAttrs(editor)[0];

function cardPos(editor: Editor) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "linkCard") found = pos;
  });
  return found;
}

function mentionAttrs(editor: Editor) {
  let found: Record<string, unknown> | undefined;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "linkMention") found = node.attrs;
  });
  return found;
}

function mentionPos(editor: Editor) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "linkMention") found = pos;
  });
  return found;
}

function expectMentionSelected(editor: Editor) {
  const { selection } = editor.state;
  expect(selection).toBeInstanceOf(NodeSelection);
  expect((selection as NodeSelection).node.type.name).toBe("linkMention");
  expect(selection.from).toBe(mentionPos(editor));
}

// Node views render in a microtask after the transaction, so the act has to be async.
async function insertCard(editor: Editor) {
  await act(async () => {
    editor.commands.insertContentAt(
      editor.state.doc.content.size,
      card({ url }),
    );
  });
}

async function insertPendingCard(editor: Editor) {
  markLinkPreviewPending(editor, url);
  await insertCard(editor);
}

function holdQueryNotifications() {
  const held: Array<() => void> = [];
  notifyManager.setScheduler((callback) => held.push(callback));
  return () => held.splice(0).forEach((callback) => callback());
}

const imageWithSource = (src: string) =>
  document.querySelector(`img[src="${src}"]`);
const nodeViewImage = () =>
  document.querySelector(".node-linkCard img, .node-linkMention img");

beforeAll(() => {
  window.matchMedia ??= (media) => ({
    media,
    matches: false,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getLinkPreview).mockResolvedValue(preview);
});

afterEach(() => {
  cleanup();
  editors.splice(0).forEach((editor) => editor.destroy());
  notifyManager.setScheduler(defaultScheduler);
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("filling a preview", () => {
  it("fills a pending card's preview once", async () => {
    const editor = show([paragraph()]);

    await insertPendingCard(editor);

    expect(screen.getByRole("status", { name: "Loading preview" })).toBeTruthy();
    await waitFor(() => expect(cardAttrs(editor)).toEqual({ url, ...preview }));
    expect(await screen.findByText("Example title")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(getLinkPreview).toHaveBeenCalledTimes(1);
    expect(getLinkPreview).toHaveBeenCalledWith({ url });
    expect(isLinkPreviewPending(editor, url)).toBe(false);
  });

  it.each([
    ["no preview", () => Promise.resolve(null)],
    ["a failed request", () => Promise.reject(new Error("offline"))],
  ])("keeps the fallback and clears the pending mark after %s", async (_, result) => {
    vi.mocked(getLinkPreview).mockImplementation(result);
    const editor = show([paragraph()]);

    await insertPendingCard(editor);

    expect(await screen.findByText("example.com/a")).toBeTruthy();
    expect(isLinkPreviewPending(editor, url)).toBe(false);
    expect(cardAttrs(editor)?.title).toBeNull();
    expect(getLinkPreview).toHaveBeenCalledTimes(1);
  });

  it("leaves a card that isn't pending alone", async () => {
    const editor = show([card({ url })]);

    expect(await screen.findByText("example.com/a")).toBeTruthy();
    expect(getLinkPreview).not.toHaveBeenCalled();
    expect(cardAttrs(editor)?.title).toBeNull();
  });

  it("asks the server again for a URL whose last preview failed", async () => {
    vi.mocked(getLinkPreview).mockResolvedValueOnce(null);
    const editor = show([paragraph()]);

    await insertPendingCard(editor);
    expect(await screen.findByText("example.com/a")).toBeTruthy();
    await insertPendingCard(editor);

    await waitFor(() =>
      expect(allCardAttrs(editor).at(-1)).toEqual({ url, ...preview }),
    );
    expect(getLinkPreview).toHaveBeenCalledTimes(2);
  });

  it("fills only the converted card, not an older card with the same URL", async () => {
    const editor = show([card({ url })]);
    await screen.findByText("example.com/a");

    await insertPendingCard(editor);

    await waitFor(() =>
      expect(allCardAttrs(editor)[1]).toEqual({ url, ...preview }),
    );
    expect(allCardAttrs(editor)[0].title).toBeNull();
  });

  it("doesn't retry a failed preview when the connection comes back", async () => {
    vi.mocked(getLinkPreview).mockResolvedValue(null);
    const editor = show([paragraph()]);
    await insertPendingCard(editor);
    await screen.findByText("example.com/a");

    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });

    expect(getLinkPreview).toHaveBeenCalledTimes(1);
  });

  it("lets a pending mark expire after 30 seconds", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const editor = show([paragraph()]);
    markLinkPreviewPending(editor, url);
    clock.mockReturnValue(1_000_000 + LINK_PREVIEW_PENDING_TTL_MS);

    await insertCard(editor);

    expect(screen.getByText("example.com/a")).toBeTruthy();
    expect(getLinkPreview).not.toHaveBeenCalled();
    expect(isLinkPreviewPending(editor, url)).toBe(false);
  });

  it.each([
    [
      "got a title",
      (editor: Editor, pos: number) =>
        editor.state.tr.setNodeMarkup(pos, undefined, {
          url,
          title: "Typed title",
        }),
    ],
    [
      "got another URL",
      (editor: Editor, pos: number) =>
        editor.state.tr.setNodeMarkup(pos, undefined, { url: otherUrl }),
    ],
    [
      "was replaced",
      (editor: Editor, pos: number) =>
        editor.state.tr.replaceWith(
          pos,
          pos + 1,
          editor.schema.nodes.paragraph.create(
            null,
            editor.schema.text("Replaced"),
          ),
        ),
    ],
  ])("writes no preview into a card that %s during the fetch", async (_, change) => {
    let resolvePreview: (value: LinkPreview) => void;
    vi.mocked(getLinkPreview).mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );
    const editor = show([paragraph()]);
    const deliverQueryNotifications = holdQueryNotifications();
    await insertPendingCard(editor);
    await act(async () => {
      resolvePreview(preview);
    });

    let changed: JSONContent;
    act(() => {
      editor.view.dispatch(change(editor, cardPos(editor)));
      changed = editor.getJSON();
      // The view still renders the old node when the preview lands, so only the write guard stops the fill.
      deliverQueryNotifications();
    });
    await act(async () => {});

    expect(editor.getJSON()).toEqual(changed);
  });

  it("undo after choosing Card returns to the link", async () => {
    let resolvePreview: (value: LinkPreview) => void;
    vi.mocked(getLinkPreview).mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );
    const editor = show([
      paragraph(
        text("Read "),
        text(url, [{ type: "link", attrs: { href: url } }]),
        text(" today"),
      ),
    ]);
    const before = editor.getJSON();

    markLinkPreviewPending(editor, url);
    await act(async () => {
      // Converted a second before the preview arrives, so the history can't merge the fill into this step.
      const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() - 1000);
      convertLinkDisplay(
        editor,
        { kind: "link", from: 6, to: 6 + url.length, url, attrs: { url } },
        "card",
        LINK_PREVIEW_NODES,
      );
      clock.mockRestore();
    });
    resolvePreview(preview);
    await waitFor(() => expect(cardAttrs(editor)).toEqual({ url, ...preview }));

    await act(async () => {
      editor.commands.undo();
    });

    expect(editor.getJSON()).toEqual(before);
  });

  it("a card switched to a mention from the toolbar during the fetch still gets the preview", async () => {
    let resolvePreview: (value: LinkPreview) => void;
    vi.mocked(getLinkPreview).mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );
    const editor = show([paragraph()]);
    render(
      <MantineProvider env="test">
        <LinkPasteMenu editor={editor} />
      </MantineProvider>,
    );
    await insertPendingCard(editor);
    act(() => {
      editor.commands.setNodeSelection(cardPos(editor));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Mention" }));
    });

    expect(cardPos(editor)).toBe(-1);
    expect(
      document.querySelector(".node-linkMention a")?.getAttribute("aria-busy"),
    ).toBe("true");
    await act(async () => {
      resolvePreview(preview);
    });
    await waitFor(() =>
      expect(mentionAttrs(editor)).toEqual({ url, ...preview }),
    );
    expect(getLinkPreview).toHaveBeenCalledTimes(1);
    expect(isLinkPreviewPending(editor, url)).toBe(false);
  });

  it("keeps a selected mention selected when its preview arrives", async () => {
    let resolvePreview: (value: LinkPreview) => void;
    vi.mocked(getLinkPreview).mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );
    const editor = show([paragraph(text("Read "))]);
    markLinkPreviewPending(editor, url);
    await act(async () => {
      editor.commands.insertContentAt(6, mention({ url }));
    });
    act(() => {
      editor.commands.setNodeSelection(mentionPos(editor));
    });

    await act(async () => {
      resolvePreview(preview);
    });

    await waitFor(() =>
      expect(mentionAttrs(editor)).toEqual({ url, ...preview }),
    );
    expectMentionSelected(editor);
  });

  it("never fetches in a read-only editor", async () => {
    const editor = show([paragraph()], { editable: false });

    await insertPendingCard(editor);

    expect(screen.getByText("example.com/a")).toBeTruthy();
    expect(getLinkPreview).not.toHaveBeenCalled();
    expect(cardAttrs(editor)?.title).toBeNull();
  });

  it("never fetches when logged out", async () => {
    const editor = show([paragraph()], { loggedIn: false });

    await insertPendingCard(editor);

    expect(screen.getByText("example.com/a")).toBeTruthy();
    expect(getLinkPreview).not.toHaveBeenCalled();
    expect(cardAttrs(editor)?.title).toBeNull();
  });
});

describe("Refresh preview", () => {
  it("keeps a selected mention selected and the toolbar open", async () => {
    const fresh: LinkPreview = {
      title: "Fresh title",
      icon: "https://example.com/fresh.png",
    };
    vi.mocked(getLinkPreview).mockResolvedValue(fresh);
    const editor = show([
      paragraph(text("Read "), mention({ url, ...preview })),
    ]);
    render(
      <MantineProvider env="test">
        <LinkPasteMenu editor={editor} />
      </MantineProvider>,
    );
    await screen.findByText("Example title");
    act(() => {
      editor.commands.setNodeSelection(mentionPos(editor));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh preview" }));
    });

    await waitFor(() =>
      expect(mentionAttrs(editor)).toEqual({
        url,
        title: "Fresh title",
        description: null,
        image: null,
        icon: "https://example.com/fresh.png",
      }),
    );
    expect(getLinkPreview).toHaveBeenCalledWith({ url, refresh: true });
    expectMentionSelected(editor);
    expect(screen.getByRole("toolbar", { name: "Link actions" })).toBeTruthy();

    // One undoable step.
    act(() => {
      editor.commands.undo();
    });
    expect(mentionAttrs(editor)).toEqual({ url, ...preview });
  });
});

describe("LinkCardView", () => {
  it("renders a stored preview", async () => {
    show([card({ url, ...preview })]);

    expect(await screen.findByText("Example title")).toBeTruthy();
    expect(screen.getByText("Example description")).toBeTruthy();
    expect(screen.getByText("example.com/a")).toBeTruthy();
    for (const src of [preview.image, preview.icon]) {
      const image = imageWithSource(src);
      expect(image?.getAttribute("referrerpolicy")).toBe("no-referrer");
      expect(image?.getAttribute("decoding")).toBe("async");
      expect(image?.hasAttribute("loading")).toBe(false);
    }
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("hides a broken image", async () => {
    show([card({ url, ...preview })]);
    await screen.findByText("Example title");

    fireEvent.error(imageWithSource(preview.image)!);
    fireEvent.error(imageWithSource(preview.icon)!);

    expect(imageWithSource(preview.image)).toBeNull();
    expect(imageWithSource(preview.icon)).toBeNull();
    expect(screen.getByText("Example title")).toBeTruthy();
  });

  it("never renders unsafe image or icon URLs", async () => {
    show([
      card({ url, title: "Example title", image: unsafeUrl, icon: unsafeUrl }),
      paragraph(mention({ url, title: "Mention title", icon: unsafeUrl })),
      card({ url: unsafeUrl, title: "Unsafe link" }),
    ]);
    await screen.findByText("Example title");
    await screen.findByText("Mention title");

    expect(nodeViewImage()).toBeNull();
    expect(screen.getByText("Unsafe link").closest("a")?.hasAttribute("href")).toBe(
      false,
    );
  });
});

describe("LinkMentionView", () => {
  it("the mention shows favicon and title, falling back to host and path", async () => {
    show([
      paragraph(
        mention({ url, ...preview }),
        text(" and "),
        mention({ url: "https://example.com/b/" }),
      ),
    ]);

    const titled = (await screen.findByText("Example title")).closest("a")!;
    expect(titled.getAttribute("href")).toBe(url);
    expect(titled.getAttribute("target")).toBe("_blank");
    expect(titled.getAttribute("title")).toBe(`Example title\n${url}`);
    expect(titled.querySelector("img")?.getAttribute("src")).toBe(preview.icon);

    const fallback = screen.getByText("example.com/b").closest("a")!;
    expect(fallback.getAttribute("title")).toBe("https://example.com/b/");
    expect(fallback.querySelector("img")).toBeNull();
    expect(fallback.querySelector(".tabler-icon-world")).not.toBeNull();
  });
});
