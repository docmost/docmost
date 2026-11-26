import { MantineProvider } from "@mantine/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LinkView from "./link-view";
import { getMarkRange } from "@tiptap/core";
import { convertLinkDisplay } from "@/features/editor/utils/link-display";
import { markLinkPreviewPending } from "@/features/editor/components/link-preview/link-preview-pending";
import { LINK_PREVIEW_NODES } from "@/features/editor/components/link-preview/link-preview-display";

vi.mock("@tiptap/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tiptap/core")>()),
  getMarkRange: vi.fn(() => undefined),
}));

vi.mock("@/features/editor/utils/link-display", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/editor/utils/link-display")>()),
  convertLinkDisplay: vi.fn(() => true),
  getLinkDisplayCardAvailability: vi.fn(() => ({ canUseCard: true })),
}));

vi.mock("@/features/editor/components/link-preview/link-preview-pending", () => ({
  markLinkPreviewPending: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (value: string) => value }),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/s/example/p/page" }),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

const installedIntegrations = vi.hoisted(() => [
  { type: "github", unfurlHosts: ["github.com"] },
]);
const integrationsQuery = vi.hoisted(() => ({ loading: false }));

vi.mock("@/features/integration/queries/integration-query", () => ({
  useInstalledIntegrations: () =>
    integrationsQuery.loading
      ? { data: undefined, isPending: true }
      : { data: installedIntegrations, isPending: false },
}));

vi.mock("@/features/page/queries/page-query.ts", () => ({
  usePageQuery: () => ({ data: undefined }),
}));

vi.mock("@/features/share/queries/share-query.ts", () => ({
  useSharePageQuery: () => ({ data: undefined }),
}));

vi.mock("@/features/public-space/queries/public-space-query.ts", () => ({
  usePublicSpacePageQuery: () => ({ data: undefined }),
}));

vi.mock("@/features/editor/components/link/link-editor-panel.tsx", () => ({
  LinkEditorPanel: () => null,
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

function renderDetachedLinkView(
  attrs: Record<string, unknown> = {
    href: "https://github.com/docmost/docmost/pull/2475",
    integrationProvider: "github",
    internal: false,
  },
  isEditable = true,
  editorOverrides: Record<string, unknown> = {},
) {
  const props = {
    editor: {
      isEditable,
      state: {
        doc: {
          content: { size: 100 },
          resolve: (position: number) => {
            if (position < 0) {
              throw new RangeError(`Position ${position} out of range`);
            }
            return {};
          },
        },
      },
      view: { posAtDOM: () => -1 },
      ...editorOverrides,
    },
    mark: {
      attrs,
      type: { name: "link" },
    },
  };

  const renderView = () => (
    <MantineProvider>
      <LinkView {...(props as unknown as ComponentProps<typeof LinkView>)} />
    </MantineProvider>
  );

  return { ...render(renderView()), renderView };
}

describe("LinkView", () => {
  beforeEach(setMediaMatch);
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    integrationsQuery.loading = false;
  });

  it("does not resolve the mark position while the popover is closed", () => {
    const { rerender, renderView } = renderDetachedLinkView();

    expect(() => rerender(renderView())).not.toThrow();
  });

  it("does not resolve a negative mark-view position after opening", () => {
    const { container } = renderDetachedLinkView();
    const link = container.querySelector("a");
    expect(link).not.toBeNull();

    expect(() => fireEvent.click(link!)).not.toThrow();
  });

  it("opens URL-current display choices from the existing link action row", async () => {
    const { container } = renderDetachedLinkView();
    const link = container.querySelector("a");
    const popoverTarget = container.querySelector('[aria-haspopup="dialog"]');
    expect(link).not.toBeNull();
    expect(popoverTarget).not.toBeNull();

    fireEvent.click(link!);

    const menu = await screen.findByRole("dialog", { hidden: true });
    const menuQueries = within(menu);
    const display = menuQueries.getByRole("button", {
      name: "Display as: URL",
      hidden: true,
    });
    fireEvent.click(display);

    const displayMenu = await screen.findByRole("menu", { hidden: true });
    expect(
      within(displayMenu)
        .getByRole("menuitemradio", { name: "URL", hidden: true })
        .getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.mouseDown(
      within(displayMenu).getByRole("menuitemradio", {
        name: "Mention",
        hidden: true,
      }),
    );
    expect(popoverTarget?.getAttribute("aria-expanded")).toBe("true");
  });

  it("offers display choices for a plain link on a host the provider serves", async () => {
    const { container } = renderDetachedLinkView({
      href: "https://github.com/docmost/docmost/pull/2475",
      internal: false,
    });

    fireEvent.click(container.querySelector("a")!);

    const menu = await screen.findByRole("dialog", { hidden: true });
    expect(
      within(menu).getByRole("button", {
        name: "Display as: URL",
        hidden: true,
      }),
    ).toBeTruthy();
  });

  it("offers the plain link display choices for a GitHub-like path on a host GitHub does not serve", async () => {
    const { container } = renderDetachedLinkView({
      href: "https://gitea.example.com/team/app/pulls/7",
      internal: false,
    });

    fireEvent.click(container.querySelector("a")!);

    const menu = await screen.findByRole("dialog", { hidden: true });
    expect(
      within(menu).getByRole("button", {
        name: "Display as: URL",
        hidden: true,
      }),
    ).toBeTruthy();
  });

  it("supports keyboard-generated clicks on link-menu actions", async () => {
    const { container } = renderDetachedLinkView();
    const link = container.querySelector("a");
    expect(link).not.toBeNull();

    fireEvent.click(link!);

    const menu = await screen.findByRole("dialog", { hidden: true });
    const edit = within(menu).getByRole("button", {
      name: "Edit link",
      hidden: true,
    });
    fireEvent.click(edit);

    expect(await within(menu).findByText("Page or URL")).toBeTruthy();
  });

  it("closes the integrated link menu when Escape is pressed on the selector", async () => {
    const { container } = renderDetachedLinkView();
    const link = container.querySelector("a");
    const target = container.querySelector('[aria-haspopup="dialog"]');
    expect(link).not.toBeNull();
    expect(target).not.toBeNull();

    fireEvent.click(link!);
    expect(target?.getAttribute("aria-expanded")).toBe("true");

    const menu = await screen.findByRole("dialog", { hidden: true });
    const display = within(menu).getByRole("button", {
      name: "Display as: URL",
      hidden: true,
    });
    fireEvent.keyDown(display, { key: "Escape" });

    expect(target?.getAttribute("aria-expanded")).toBe("false");
  });

  it("an external link offers Display as when editable", async () => {
    const { container } = renderDetachedLinkView({
      href: "https://example.com/article",
      internal: false,
    });

    fireEvent.click(container.querySelector("a")!);

    const menu = await screen.findByRole("dialog", { hidden: true });
    expect(
      within(menu).getByRole("button", {
        name: "Display as: URL",
        hidden: true,
      }),
    ).toBeTruthy();
  });

  it.each([
    [
      "a provider pattern",
      {
        href: "https://github.com/docmost/docmost/pull/2475",
        internal: false,
      },
    ],
    [
      "a mark provider",
      {
        href: "https://example.com/article",
        integrationProvider: "github",
        internal: false,
      },
    ],
  ])(
    "a link with %s gets no Display as until the installed integrations load",
    async (_, attrs) => {
      integrationsQuery.loading = true;
      const { container, rerender, renderView } = renderDetachedLinkView(attrs);

      fireEvent.click(container.querySelector("a")!);

      const menu = await screen.findByRole("dialog", { hidden: true });
      expect(
        within(menu).getByRole("button", { name: "Edit link", hidden: true }),
      ).toBeTruthy();
      expect(
        within(menu).queryByRole("button", {
          name: /Display as/,
          hidden: true,
        }),
      ).toBeNull();

      integrationsQuery.loading = false;
      rerender(renderView());

      expect(
        within(menu).getByRole("button", {
          name: "Display as: URL",
          hidden: true,
        }),
      ).toBeTruthy();
    },
  );

  it("no Display as for a page link", async () => {
    const { container } = renderDetachedLinkView({
      href: `${window.location.origin}/s/example/p/page-slug123`,
      internal: false,
    });

    fireEvent.click(container.querySelector("a")!);

    const menu = await screen.findByRole("dialog", { hidden: true });
    expect(
      within(menu).getByRole("button", { name: "Edit link", hidden: true }),
    ).toBeTruthy();
    expect(
      within(menu).queryByRole("button", {
        name: /Display as/,
        hidden: true,
      }),
    ).toBeNull();
  });

  it("choosing Mention on a plain external link marks the URL pending, then converts the mark range", async () => {
    const href = "https://example.com/article";
    vi.mocked(getMarkRange).mockReturnValue({ from: 3, to: 20 } as never);
    const { container } = renderDetachedLinkView(
      { href, internal: false },
      true,
      {
        view: { posAtDOM: () => 5 },
        commands: { focus: vi.fn() },
      },
    );

    fireEvent.click(container.querySelector("a")!);
    const menu = await screen.findByRole("dialog", { hidden: true });
    fireEvent.click(
      within(menu).getByRole("button", {
        name: "Display as: URL",
        hidden: true,
      }),
    );
    const displayMenu = await screen.findByRole("menu", { hidden: true });
    fireEvent.click(
      within(displayMenu).getByRole("menuitemradio", {
        name: "Mention",
        hidden: true,
      }),
    );

    expect(convertLinkDisplay).toHaveBeenCalledTimes(1);
    const [editorArg, source, display, nodes] =
      vi.mocked(convertLinkDisplay).mock.calls[0];
    expect(markLinkPreviewPending).toHaveBeenCalledWith(editorArg, href);
    expect(
      vi.mocked(markLinkPreviewPending).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(convertLinkDisplay).mock.invocationCallOrder[0]);
    expect(source).toEqual({
      kind: "link",
      from: 3,
      to: 20,
      url: href,
      attrs: { url: href },
    });
    expect(display).toBe("mention");
    expect(nodes).toBe(LINK_PREVIEW_NODES);
  });
});
