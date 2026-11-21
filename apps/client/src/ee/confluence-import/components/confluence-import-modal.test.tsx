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

const optionName = "Check every page for attachments and comments";
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
  post
    .mockResolvedValueOnce({ data: { success: true, edition } })
    .mockResolvedValueOnce({
      data: {
        success: true,
        spaces: [{ id: "1", key: "ENG", name: "Engineering" }],
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

function fullEnumerationOption() {
  return screen.getByRole<HTMLInputElement>("checkbox", { name: optionName });
}

function blueprintsOption() {
  return screen.getByRole<HTMLInputElement>("checkbox", {
    name: "Import Confluence blueprints",
  });
}

it("sends the full enumeration option when selected for Data Center", async () => {
  renderImport();
  await selectSpaces("server");
  expect(fullEnumerationOption().checked).toBe(false);
  fireEvent.click(fullEnumerationOption());
  expect(await startImport()).toHaveProperty("fullEnumeration", true);
});

it("uses the fast default for a new Data Center connection", async () => {
  renderImport();
  await selectSpaces("server");
  fireEvent.click(fullEnumerationOption());
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  fireEvent.change(screen.getByLabelText(/^Site URL/), {
    target: { value: "https://another.example.com" },
  });
  await selectSpaces("server");

  expect(fullEnumerationOption().checked).toBe(false);
  expect(await startImport()).not.toHaveProperty("fullEnumeration");
});

it("requires Data Center detection before showing the option", async () => {
  renderImport();
  await selectSpaces("cloud");
  expect(screen.queryByRole("checkbox", { name: optionName })).toBeNull();
});

it("drops a previous Data Center opt-in when switching to Cloud", async () => {
  renderImport();
  await selectSpaces("server");
  fireEvent.click(fullEnumerationOption());
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  fireEvent.click(screen.getByRole("radio", { name: "Cloud" }));
  await selectSpaces("cloud");

  expect(screen.queryByRole("checkbox", { name: optionName })).toBeNull();
  const payload = await startImport();
  expect(payload).toHaveProperty("authType", "cloud_token");
  expect(payload).not.toHaveProperty("fullEnumeration");
});

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
  fireEvent.click(screen.getByRole("radio", { name: "Full history" }));
  setOpened(false);
  setOpened(true);

  enterCredentials("server");
  await selectSpaces("server", { pageHistoryAvailable: true });
  expect(blueprintsOption().checked).toBe(false);
  expect(screen.queryByRole("radio", { name: "Full history" })).toBeNull();
  const payload = await startImport();
  expect(payload).toHaveProperty("includeBlueprints", false);
  expect(payload).not.toHaveProperty("pageHistoryMode");
});

it.each([
  ["server", "previous"],
  ["cloud", "full"],
] as const)("submits the selected history mode for %s", async (edition, mode) => {
  renderImport(edition);
  await selectSpaces(edition, { pageHistoryAvailable: true });

  const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
    name: pageHistoryOption,
  });
  expect(checkbox.checked).toBe(false);
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(checkbox);

  const warning = screen.getByRole("alert").textContent;
  expect(warning).toMatch(/once the pages are imported/i);
  expect(warning).toMatch(/some revisions may be skipped/i);
  const previous = screen.getByRole<HTMLInputElement>("radio", {
    name: "Previous version only",
  });
  expect(previous.checked).toBe(true);
  if (mode === "full") {
    fireEvent.click(screen.getByRole("radio", { name: "Full history" }));
  }
  expect(await startImport()).toHaveProperty("pageHistoryMode", mode);
});

it("omits page history if the administrator turns it back off", async () => {
  renderImport();
  await selectSpaces("server", { pageHistoryAvailable: true });
  const checkbox = screen.getByRole("checkbox", { name: pageHistoryOption });
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("radio", { name: "Full history" }));
  fireEvent.click(checkbox);

  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("radio", { name: "Full history" })).toBeNull();
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
