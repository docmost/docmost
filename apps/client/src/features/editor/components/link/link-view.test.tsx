import { MantineProvider } from "@mantine/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LinkView from "./link-view";

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

vi.mock("@/features/integration/queries/integration-query", () => ({
  useInstalledIntegrations: () => ({ data: installedIntegrations }),
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
) {
  const props = {
    editor: {
      isEditable: true,
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
  afterEach(cleanup);

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
    const edit = menuQueries.getByRole("button", {
      name: "Edit link",
      hidden: true,
    });
    const display = menuQueries.getByRole("button", {
      name: "Display as: URL",
      hidden: true,
    });
    expect(display.parentElement).toBe(edit.parentElement);
    expect(
      menuQueries.getByRole("button", { name: "Copy link", hidden: true }),
    ).toBeTruthy();
    expect(
      menuQueries.getByRole("button", { name: "Remove link", hidden: true }),
    ).toBeTruthy();
    expect(menuQueries.queryByRole("radiogroup", { hidden: true })).toBeNull();

    fireEvent.click(display);

    const displayMenu = await screen.findByRole("menu", { hidden: true });
    expect(menu.contains(displayMenu)).toBe(false);
    expect(
      within(displayMenu)
        .getByRole("menuitemradio", { name: "URL", hidden: true })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      within(displayMenu).getByRole("menuitemradio", {
        name: /Card/,
        hidden: true,
      }),
    ).toBeTruthy();
    expect(
      within(displayMenu).getByRole("menuitemradio", {
        name: "Mention",
        hidden: true,
      }),
    ).toBeTruthy();

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

  it("hides display choices for a GitHub-like path on a host GitHub does not serve", async () => {
    const { container } = renderDetachedLinkView({
      href: "https://gitea.example.com/team/app/pulls/7",
      internal: false,
    });

    fireEvent.click(container.querySelector("a")!);

    const menu = await screen.findByRole("dialog", { hidden: true });
    expect(
      within(menu).getByRole("button", { name: "Edit link", hidden: true }),
    ).toBeTruthy();
    expect(
      within(menu).queryByRole("button", {
        name: "Display as: URL",
        hidden: true,
      }),
    ).toBeNull();
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
});
