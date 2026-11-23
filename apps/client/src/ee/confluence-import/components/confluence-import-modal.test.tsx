import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import type { ConfluenceEdition } from "../types/confluence-import.types";
import ConfluenceImportModal from "./confluence-import-modal";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const pageHistoryOption = "Import page history (experimental)";
const post = vi.mocked(api.post);

beforeEach(() => {
  post
    .mockReset()
    .mockResolvedValue({ data: { success: true, fileTaskId: "task" } });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderImport(edition: ConfluenceEdition = "server") {
  const client = new QueryClient();
  const onClose = vi.fn();
  const { rerender } = render(
    <ConfluenceImportModal opened onClose={onClose} />,
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <MantineProvider env="test">{children}</MantineProvider>
        </QueryClientProvider>
      ),
    },
  );
  enterCredentials(edition);
  return (opened: boolean) =>
    rerender(<ConfluenceImportModal opened={opened} onClose={onClose} />);
}

function enterCredentials(edition: ConfluenceEdition) {
  if (edition === "cloud") {
    fireEvent.click(screen.getByRole("radio", { name: "Cloud" }));
  }
  fireEvent.change(screen.getByLabelText(/^Site URL/), {
    target: { value: "https://confluence.example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^Email/), {
    target: { value: "admin@example.com" },
  });
  fireEvent.change(
    screen.getByLabelText(
      edition === "cloud" ? /^API token/ : /^Personal Access Token/,
      {
        selector: "input[type=password]",
      },
    ),
    { target: { value: "token" } },
  );
}

async function selectSpaces(
  edition: ConfluenceEdition,
  capabilities: { pageHistoryAvailable?: boolean } = {},
) {
  post.mockResolvedValueOnce({
    data: {
      success: true,
      edition,
      ...capabilities,
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Test & continue" }));
  await screen.findByRole("button", { name: "Start import" });
}

async function startImport() {
  fireEvent.click(screen.getByRole("button", { name: "Start import" }));
  await waitFor(() =>
    expect(post).toHaveBeenLastCalledWith(
      "/confluence-import/start",
      expect.anything(),
    ),
  );
  return post.mock.lastCall[1];
}

function blueprintsOption() {
  return screen.getByRole<HTMLInputElement>("checkbox", {
    name: "Import Confluence blueprints",
  });
}

it.each([
  {
    switchTo: undefined,
    edition: "server",
    credentials: { authType: "basic", username: "admin", password: " pass " },
  },
  {
    switchTo: "Personal Access Token",
    edition: "server",
    credentials: { authType: "pat", token: "new-token" },
  },
  {
    switchTo: "Cloud",
    edition: "cloud",
    credentials: { authType: "cloud_token", token: "new-token" },
  },
] as const)(
  "sends only $credentials.authType credentials on every request after switching methods",
  async ({ switchTo, edition, credentials }) => {
    renderImport();
    fireEvent.click(screen.getByRole("radio", { name: "Username + password" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Username/ }), {
      target: { value: " admin " },
    });
    fireEvent.change(
      screen.getByLabelText(/^Password/, { selector: "input[type=password]" }),
      { target: { value: " pass " } },
    );
    if (switchTo) {
      fireEvent.click(screen.getByRole("radio", { name: switchTo }));
      fireEvent.change(
        screen.getByLabelText(/^(Personal Access Token|API token)/, {
          selector: "input[type=password]",
        }),
        { target: { value: " new-token " } },
      );
    }

    await selectSpaces(edition);
    post.mockResolvedValueOnce({
      data: {
        success: true,
        spaces: [{ id: "1", key: "ENG", name: "Engineering" }],
        next: null,
      },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Import all spaces" }));
    fireEvent.click(
      await screen.findByRole("checkbox", { name: /Engineering/ }),
    );
    await startImport();

    const expected = {
      siteUrl: "https://confluence.example.com",
      email: "admin@example.com",
      ...credentials,
    };
    expect(post.mock.calls.map(([url, body]) => [url, body])).toStrictEqual([
      ["/confluence-import/test-connection", expected],
      ["/confluence-import/spaces", { ...expected, status: "current" }],
      [
        "/confluence-import/start",
        { ...expected, spaceKeys: ["ENG"], includeBlueprints: false },
      ],
    ]);
  },
);

it.each([
  { code: "ECONNABORTED" },
  { response: { status: 408 } },
])("allows another connection check after a timeout (%j)", async (error) => {
  renderImport();
  post.mockRejectedValueOnce(error);
  fireEvent.click(screen.getByRole("button", { name: "Test & continue" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "The connection test timed out after 30 seconds.",
  );
  await selectSpaces("server");
  expect(post).toHaveBeenCalledTimes(2);
  expect(post).toHaveBeenLastCalledWith(
    "/confluence-import/test-connection",
    expect.anything(),
    expect.objectContaining({ timeout: 30_000, params: { includeSpaces: false } }),
  );
});

it("can start an all-spaces import immediately after the credentials pass", async () => {
  renderImport();
  await selectSpaces("server");
  expect(post).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Import all spaces",
    }).checked,
  ).toBe(true);
  expect(await startImport()).toHaveProperty("spaceKeys", []);
  expect(post).toHaveBeenCalledTimes(2);
});

it("loads individual spaces on demand and keeps selections across pages and retries", async () => {
  renderImport();
  await selectSpaces("server");
  post.mockResolvedValueOnce({
    data: {
      success: true,
      spaces: [{ id: "1", key: "ENG", name: "Engineering" }],
      next: { status: "archived" },
    },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "Import all spaces" }));
  const first = await screen.findByRole("checkbox", { name: /Engineering/ });
  expect(post).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Start import" })
      .disabled,
  ).toBe(true);
  fireEvent.click(first);
  post.mockResolvedValueOnce({
    data: { success: false, error: "Page temporarily unavailable" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Page temporarily unavailable");
  post.mockResolvedValueOnce({
    data: {
      success: true,
      spaces: [{ id: "7000", key: "OLD", name: "Archive" }],
      next: null,
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: /Archive/ }));
  expect(post).toHaveBeenLastCalledWith(
    "/confluence-import/spaces",
    expect.objectContaining({ status: "archived" }),
    expect.anything(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: /Engineering/ })
      .checked,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: /Archive/ }).checked,
  ).toBe(true);
  expect(post).toHaveBeenCalledTimes(4);
  expect(await startImport()).toHaveProperty("spaceKeys", ["ENG", "OLD"]);
});

it("can switch back to all spaces while an individual batch is pending", async () => {
  renderImport();
  await selectSpaces("server");
  post.mockImplementationOnce(() => new Promise(() => {}));
  const all = screen.getByRole("checkbox", { name: "Import all spaces" });
  fireEvent.click(all);
  await screen.findByRole("status");
  const signal = post.mock.lastCall[2].signal;
  fireEvent.click(all);
  expect(signal.aborted).toBe(true);
  expect(await startImport()).toHaveProperty("spaceKeys", []);
});

it.each(["server", "cloud"] as const)(
  "uses the default attachment and comment lookup on %s",
  async (edition) => {
    renderImport(edition);
    await selectSpaces(edition);
    expect(
      screen.queryByRole("checkbox", {
        name: "Check every page for attachments and comments",
      }),
    ).toBeNull();
    expect(await startImport()).not.toHaveProperty("fullEnumeration");
  },
);

it.each(["cloud", "server"] as const)(
  "sends selected blueprints with a %s import",
  async (edition) => {
    renderImport(edition);
    await selectSpaces(edition);
    expect(blueprintsOption().checked).toBe(false);
    fireEvent.click(blueprintsOption());
    expect(await startImport()).toHaveProperty("includeBlueprints", true);
  },
);

it("clears optional imports when the wizard is reopened", async () => {
  const setOpened = renderImport();
  await selectSpaces("server", { pageHistoryAvailable: true });
  fireEvent.click(blueprintsOption());
  fireEvent.click(screen.getByRole("checkbox", { name: pageHistoryOption }));
  setOpened(false);
  setOpened(true);

  enterCredentials("server");
  await selectSpaces("server", { pageHistoryAvailable: true });
  expect(blueprintsOption().checked).toBe(false);
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: pageHistoryOption })
      .checked,
  ).toBe(false);
  const payload = await startImport();
  expect(payload).toHaveProperty("includeBlueprints", false);
  expect(payload).not.toHaveProperty("pageHistoryMode");
});

it.each(["server", "cloud"] as const)(
  "requests full history when the administrator enables it on %s",
  async (edition) => {
    renderImport(edition);
    await selectSpaces(edition, { pageHistoryAvailable: true });

    const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
      name: pageHistoryOption,
    });
    expect(checkbox.checked).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(checkbox);

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(
      "Once the pages are imported, Docmost imports their history on a best-effort basis.",
    );
    expect(await startImport()).toHaveProperty("pageHistoryMode", "full");
  },
);

it("omits page history if the administrator turns it back off", async () => {
  renderImport();
  await selectSpaces("server", { pageHistoryAvailable: true });
  const checkbox = screen.getByRole("checkbox", { name: pageHistoryOption });
  fireEvent.click(checkbox);
  fireEvent.click(checkbox);

  expect(screen.queryByRole("alert")).toBeNull();
  expect(await startImport()).not.toHaveProperty("pageHistoryMode");
});

it.each([{}, { pageHistoryAvailable: false }])(
  "hides and omits page history when unavailable (%j)",
  async (capabilities) => {
    renderImport();
    await selectSpaces("server", { pageHistoryAvailable: true });
    fireEvent.click(screen.getByRole("checkbox", { name: pageHistoryOption }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.change(screen.getByLabelText(/^Site URL/), {
      target: { value: "https://another.example.com" },
    });
    await selectSpaces("server", capabilities);

    expect(
      screen.queryByRole("checkbox", { name: pageHistoryOption }),
    ).toBeNull();
    expect(await startImport()).not.toHaveProperty("pageHistoryMode");
  },
);

it.each(["server", "cloud"] as const)("opts into blog posts as pages on %s", async (edition) => {
  renderImport(edition);
  await selectSpaces(edition);
  const blogs = screen.getByRole<HTMLInputElement>("checkbox", { name: "Import blog posts as pages" });
  expect(blogs.checked).toBe(false);
  fireEvent.click(blogs);
  expect(await startImport()).toHaveProperty("includeBlogPosts", true);
});
