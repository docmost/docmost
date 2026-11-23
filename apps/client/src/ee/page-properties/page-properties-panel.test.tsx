import { MantineProvider, Menu } from "@mantine/core";
import { EventEmitter } from "node:events";
import { MemoryRouter } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createStore, Provider, type PrimitiveAtom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import { useQuerySubscription } from "@/features/websocket/use-query-subscription";
import type { ICurrentUser } from "@/features/user/types/user.types";
import api from "@/lib/api-client";
import {
  AddPagePropertyMenuItem,
  PagePropertiesPanel,
} from "./page-properties-panel";
import type { SelectTypeOptions } from "@/ee/base/types/base.types";
import type { PageProperty } from "./page-property.types";

vi.mock("@/main", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
vi.mock("@/ee/base/hooks/use-viewer-date-context", () => ({
  useViewerDateContext: () => ({
    timeZone: "America/New_York",
    today: "2026-11-22",
    weekStart: 1,
  }),
}));
vi.mock("react-i18next", async (original) => ({
  ...(await original<object>()),
  useTranslation: () => ({
    i18n: { language: "en-US" },
    t: (key: string, values: Record<string, unknown> = {}) =>
      key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name])),
  }),
}));

type ValuePatch = { values: Record<string, unknown> };
type ChoiceUpdate = { typeOptions: SelectTypeOptions };

let store: ReturnType<typeof createStore>;
let client: QueryClient;
const read = "/pages/properties";
const user = (id: string) => ({ user: { id } }) as ICurrentUser;
const license = {
  tier: "enterprise" as const,
  cloud: false,
  features: [Feature.PAGE_PROPERTIES],
};
const fields = [
  {
    name: "Status",
    type: "status",
    value: "review",
    typeOptions: {
      choices: [{ id: "review", name: "In review", color: "blue" }],
    },
  },
  { name: "Decision date", type: "date", value: { start: "2026-12-04" } },
  { name: "Estimate", type: "number", value: 0, typeOptions: { unit: "days" } },
  { name: "Notes", type: "text", value: "Draft" },
  { name: "Approved", type: "checkbox", value: false },
  { name: "Unset", type: "text", value: null },
].map((field, i) => ({
  pageId: "one",
  id: `p${i}`,
  position: `a${i}`,
  schemaVersion: 1,
  typeOptions: {},
  ...field,
})) as PageProperty[];

function SocketSubscription() {
  useQuerySubscription();
  return null;
}

function panel(
  pageId = "one",
  editable = false,
  env: "test" | "default" = "test",
) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <MantineProvider env={env}>
          <SocketSubscription />
          <Menu>
            <Menu.Target>
              <button>Page actions</button>
            </Menu.Target>
            <Menu.Dropdown>
              <AddPagePropertyMenuItem pageId={pageId} />
            </Menu.Dropdown>
          </Menu>
          <PagePropertiesPanel
            pageId={pageId}
            spaceId="space"
            editable={editable}
          />
        </MantineProvider>
      </QueryClientProvider>
    </Provider>
  );
}

function mockField(field: PageProperty) {
  vi.mocked(api.post).mockImplementation(async (url, body) => {
    if (url === read) return { data: [field] };
    return {
      data: {
        ...field,
        ...(body as Partial<PageProperty>),
        schemaVersion: field.schemaVersion + 1,
      },
    };
  });
}

async function choose(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  window.localStorage.clear();
  Element.prototype.scrollIntoView ??= () => {};
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  store = createStore();
  store.set(currentUserAtom, user("alice"));
  store.set(entitlementAtom, license);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.post).mockReset().mockResolvedValue({ data: fields });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

describe("page properties", () => {
  it("keeps an empty page clear before creating its first field and after deleting its last", async () => {
    const field = { ...fields[3], name: "Reviewer", value: null };
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: field })
      .mockResolvedValueOnce({ data: null });
    const view = render(panel("one", true));
    const section = () => screen.queryByRole("region", { name: "Properties" });
    const openActions = () =>
      fireEvent.click(screen.getByRole("button", { name: "Page actions" }));

    openActions();
    const add = await screen.findByRole("menuitem", { name: "Add property" });
    expect(section()).toBeNull();
    expect(screen.queryByRole("button", { name: "Add property" })).toBeNull();
    fireEvent.click(add);
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: field.name },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create property" }));
    const edit = await screen.findByRole("button", {
      name: "Edit property Reviewer",
    });
    expect(section()?.contains(edit)).toBe(true);
    fireEvent.click(edit);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete property" }));
    await waitFor(() => expect(section()).toBeNull());

    openActions();
    expect(
      await screen.findByRole("menuitem", { name: "Add property" }),
    ).toBeTruthy();
    view.rerender(panel("one", false));
    expect(screen.queryByRole("menuitem", { name: "Add property" })).toBeNull();
  });

  it("keeps the portalled report and its column picker inside the print exclusion", async () => {
    vi.mocked(api.post).mockImplementation(async (url) => ({
      data: url === read ? fields : { items: [], nextCursor: null },
    }));
    render(panel("one", false, "default"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Property actions" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Property report" }),
    );
    const report = await screen.findByRole("dialog", {
      name: "Property report",
    });
    expect(report.closest('section[aria-label="Properties"]')).toBeNull();
    expect(report.closest(".print-hide")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Configure report" }));
    fireEvent.click(screen.getByLabelText("Properties", { selector: "input" }));
    const option = await screen.findByRole("option", { name: "Estimate" });
    expect(option.closest(".print-hide")).toBeTruthy();
  });

  it("withholds existing report rows immediately when access changes", async () => {
    const socket = new EventEmitter();
    store.set(
      socketAtom as PrimitiveAtom<Socket | null>,
      socket as unknown as Socket,
    );
    const row = {
      id: "other-page",
      title: "Private evaluation",
      slugId: "evaluation",
      spaceName: "Engineering",
      spaceSlug: "engineering",
      isBase: false,
      properties: [{ ...fields[3], column: 0, value: "Sensitive notes" }],
    };
    let finishRead: () => void;
    const reports = vi
      .fn()
      .mockResolvedValueOnce({ data: { items: [row], nextCursor: null } })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRead = () =>
              resolve({ data: { items: [], nextCursor: null } });
          }),
      );
    vi.mocked(api.post).mockImplementation(async (url) =>
      url === read ? { data: [fields[3]] } : reports(),
    );
    render(<MemoryRouter>{panel()}</MemoryRouter>);
    fireEvent.click(
      await screen.findByRole("button", { name: "Property actions" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Property report" }),
    );
    expect(await screen.findByRole("link", { name: row.title })).toBeTruthy();
    expect(screen.getByText("Sensitive notes")).toBeTruthy();

    act(() => {
      socket.emit("message", { operation: "accessChanged" });
    });
    await waitFor(() => expect(reports).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("link", { name: row.title })).toBeNull();
    expect(screen.queryByText("Sensitive notes")).toBeNull();
    await act(async () => finishRead());
    expect(await screen.findByText("No pages match this report.")).toBeTruthy();
  });

  it("cancels an outstanding report read when the dialog closes", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(api.post).mockImplementation(async (url, _body, config) => {
      if (url === read) return { data: fields };
      signal = config?.signal as AbortSignal;
      return new Promise(() => {});
    });
    render(panel());
    fireEvent.click(
      await screen.findByRole("button", { name: "Property actions" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Property report" }),
    );
    await waitFor(() => expect(signal?.aborted).toBe(false));
    expect(api.post).toHaveBeenCalledWith(
      "/pages/properties/report",
      expect.any(Object),
      { signal },
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(signal?.aborted).toBe(true));
  });

  it("only fetches for an entitled, signed-in account and keeps view-only fields static", async () => {
    store.set(entitlementAtom, { ...license, features: [] });
    render(panel());
    expect(api.post).not.toHaveBeenCalled();
    act(() => {
      store.set(currentUserAtom, null);
      store.set(entitlementAtom, license);
    });
    expect(api.post).not.toHaveBeenCalled();
    act(() => store.set(currentUserAtom, user("alice")));
    expect(await screen.findByText("In review")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /Edit property|Reorder |Edit value/,
      }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Property actions" }));
    expect(
      await screen.findByRole("menuitem", { name: "Property report" }),
    ).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Add property" })).toBeNull();
    expect(vi.mocked(api.post).mock.calls.every(([url]) => url === read)).toBe(
      true,
    );
  });

  it("previews three populated values and remembers collapse across pages for one person", async () => {
    const view = render(panel());
    expect(await screen.findByText("· in 12 days")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Properties 6/ }));
    expect(screen.getByText("In review")).toBeTruthy();
    expect(screen.getByText("Dec 4, 2026")).toBeTruthy();
    expect(screen.getByText("0 days")).toBeTruthy();
    expect(screen.getByText("+2 more")).toBeTruthy();
    expect(screen.queryByText("Draft")).toBeNull();
    view.rerender(panel("two"));
    expect(await screen.findByText("+2 more")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /Properties 6/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    act(() => store.set(currentUserAtom, user("bob")));
    expect(await screen.findByText("Draft")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /Properties 6/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("moves a field with the keyboard and saves one edited value without touching other fields", async () => {
    let stored = fields;
    vi.mocked(api.post).mockImplementation(async (url, payload) => {
      if (url === read) return { data: stored };
      if (url === read + "/reorder") {
        const { propertyId, position } = payload as {
          propertyId: string;
          position: string;
        };
        stored = stored
          .map((p) =>
            p.id === propertyId
              ? { ...p, position, schemaVersion: p.schemaVersion + 1 }
              : p,
          )
          .sort((a, b) =>
            a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
          );
        return { data: null };
      }
      return {
        data: [{ ...fields[3], value: (payload as ValuePatch).values.p3 }],
      };
    });
    render(panel("one", true));
    fireEvent.keyDown(
      await screen.findByRole("button", { name: "Reorder Estimate" }),
      { key: "ArrowUp" },
    );
    await waitFor(() =>
      expect(screen.getAllByRole("term")[1].textContent).toBe("Estimate"),
    );
    expect(vi.mocked(api.post).mock.calls[1]).toEqual([
      read + "/reorder",
      { pageId: "one", propertyId: "p2", position: expect.any(String) },
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: "Edit value for Notes" }),
    );
    const input = screen.getByRole("textbox", { name: "Notes" });
    fireEvent.change(input, { target: { value: "Revised" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(read + "/values/update", {
        pageId: "one",
        values: { p3: "Revised" },
      }),
    );
    expect(await screen.findByText("Revised")).toBeTruthy();
    expect(screen.getByText("In review")).toBeTruthy();
  });

  it("saves a new option on the page definition before selecting its stable ID", async () => {
    let field: PageProperty = {
      ...fields[0],
      name: "Area",
      type: "select",
      value: null,
      typeOptions: { choices: [], choiceOrder: [] },
    };
    vi.mocked(api.post).mockImplementation(async (url, payload) => {
      if (url === read) return { data: [field] };
      if (url === read + "/update") {
        field = {
          ...field,
          typeOptions: (payload as ChoiceUpdate).typeOptions,
          schemaVersion: field.schemaVersion + 1,
        };
        return { data: field };
      }
      return {
        data: [{ ...field, value: (payload as ValuePatch).values[field.id] }],
      };
    });
    render(panel("one", true));
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit value for Area" }),
    );
    const search = await screen.findByRole("combobox", {
      name: "Search options for Area",
    });
    fireEvent.change(search, { target: { value: "Docs" } });
    fireEvent.click(
      await screen.findByRole("option", { name: /Add option.*Docs/ }),
    );
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
    expect(screen.getByText("Docs")).toBeTruthy();
    const writes = vi.mocked(api.post).mock.calls.slice(1);
    const choice = (writes[0][1] as ChoiceUpdate).typeOptions.choices[0];
    expect(choice).toMatchObject({
      name: "Docs",
      id: expect.any(String),
      color: expect.any(String),
    });
    expect(writes.map(([url]) => url)).toEqual([
      read + "/update",
      read + "/values/update",
    ]);
    expect(writes[0][1]).toMatchObject({ expectedSchemaVersion: 1 });
    expect(writes[1][1]).toEqual({
      pageId: "one",
      values: { [field.id]: choice.id },
    });
  });

  it("uses the saved definition for the next option in the same multi-select picker", async () => {
    let field: PageProperty = {
      ...fields[0],
      name: "Areas",
      type: "multiSelect",
      schemaVersion: 3,
      value: null,
      typeOptions: { choices: [], choiceOrder: [] },
    };
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url === read) return { data: [field] };
      if (url === read + "/update") {
        field = {
          ...field,
          typeOptions: (body as ChoiceUpdate).typeOptions,
          schemaVersion: field.schemaVersion + 1,
        };
        return { data: field };
      }
      field = { ...field, value: (body as ValuePatch).values[field.id] };
      return { data: [field] };
    });
    render(panel("one", true));
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit value for Areas" }),
    );
    const search = await screen.findByRole("combobox", {
      name: "Search options for Areas",
    });
    for (const name of ["Docs", "Support"]) {
      fireEvent.change(search, { target: { value: name } });
      fireEvent.click(
        await screen.findByRole("option", {
          name: new RegExp(`Add option.*${name}`),
        }),
      );
      expect(
        await screen.findByRole("button", { name: `Remove ${name}` }),
      ).toBeTruthy();
    }
    const [first, second] = vi
      .mocked(api.post)
      .mock.calls.filter(([url]) => url === read + "/update");
    expect(first[1]).toMatchObject({ expectedSchemaVersion: 3 });
    expect(second[1]).toMatchObject({
      expectedSchemaVersion: 4,
      typeOptions: {
        choices: [
          (first[1] as ChoiceUpdate).typeOptions.choices[0],
          expect.objectContaining({ name: "Support" }),
        ],
      },
    });
    expect(field.value).toEqual(
      (second[1] as ChoiceUpdate).typeOptions.choiceOrder,
    );
  });

  it("clears stored number options and uses the version from when the editor opened", async () => {
    const field = {
      ...fields[2],
      schemaVersion: 3,
      typeOptions: { precision: 2, defaultValue: 4, unit: "days" },
    };
    mockField(field);
    render(panel("one", true));
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit property Estimate" }),
    );
    await choose("Decimal places", "Default");
    fireEvent.change(screen.getByLabelText("Default value"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "" } });
    act(() =>
      client.setQueryData(
        ["page-properties", "alice", "one"],
        [{ ...field, schemaVersion: 4 }],
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(read + "/update", {
        pageId: "one",
        propertyId: field.id,
        expectedSchemaVersion: 3,
        typeOptions: { precision: null, defaultValue: null, unit: null },
      }),
    );
  });

  it("keeps option IDs and colors when changing a select to a multi-select", async () => {
    const choice = { id: "opt000000001", name: "Docs", color: "green" };
    const field: PageProperty = {
      ...fields[0],
      name: "Area",
      type: "select",
      schemaVersion: 2,
      value: choice.id,
      typeOptions: { choices: [choice], choiceOrder: [choice.id] },
    };
    mockField(field);
    render(panel("one", true));
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit property Area" }),
    );
    await choose("Type", "Text");
    await choose("Type", "Multi-select");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        read + "/update",
        expect.objectContaining({
          type: "multiSelect",
          expectedSchemaVersion: 2,
          typeOptions: expect.objectContaining({
            choices: [choice],
            choiceOrder: [choice.id],
          }),
        }),
      ),
    );
  });

  it("keeps a cancelled date edit and confirms time removal in the viewer's timezone", async () => {
    const field: PageProperty = {
      ...fields[1],
      typeOptions: { includeTime: true },
      value: { start: "2026-11-12T01:00:00.000Z" },
    };
    mockField(field);
    render(panel("one", true));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit property Decision date",
      }),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Include time" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Remove time from Decision date?"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "The date keeps its day in your time zone and loses the time.",
      ),
    ).toBeTruthy();
    expect(api.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("switch", { name: "Include time" })).toHaveProperty(
      "checked",
      false,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove time" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(read + "/update", {
        pageId: "one",
        propertyId: field.id,
        expectedSchemaVersion: 1,
        typeOptions: { includeTime: false },
        timeZone: "America/New_York",
      }),
    );
  });

  it("waits for confirmation before applying a lossy type change", async () => {
    mockField(fields[3]);
    render(panel("one", true));
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit property Notes" }),
    );
    await choose("Type", "Number");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Change type to Number?")).toBeTruthy();
    expect(api.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        read + "/update",
        expect.objectContaining({ type: "number" }),
      ),
    );
  });

  it("keeps the opened choice version after a refetch and skips the value write on conflict", async () => {
    const field: PageProperty = {
      ...fields[0],
      name: "Area",
      type: "select",
      schemaVersion: 2,
      value: null,
      typeOptions: { choices: [], choiceOrder: [] },
    };
    let stored = field;
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === read) return { data: [stored] };
      throw new Error("The property changed");
    });
    render(panel("one", true));
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit value for Area" }),
    );
    const search = await screen.findByRole("combobox", {
      name: "Search options for Area",
    });
    fireEvent.change(search, { target: { value: "Docs" } });
    stored = {
      ...field,
      schemaVersion: 3,
      typeOptions: {
        choices: [{ id: "opt000000001", name: "Support", color: "red" }],
        choiceOrder: ["opt000000001"],
      },
    };
    await act(() =>
      client.refetchQueries({ queryKey: ["page-properties", "alice", "one"] }),
    );
    fireEvent.click(
      await screen.findByRole("option", { name: /Add option.*Docs/ }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        read + "/update",
        expect.objectContaining({
          expectedSchemaVersion: 2,
          typeOptions: expect.objectContaining({
            choices: [expect.objectContaining({ name: "Docs" })],
          }),
        }),
      ),
    );
    expect(
      vi
        .mocked(api.post)
        .mock.calls.some(([url]) => url === read + "/values/update"),
    ).toBe(false);
  });
});
