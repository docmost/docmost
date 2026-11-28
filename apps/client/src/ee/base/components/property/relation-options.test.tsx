import type { ReactNode } from "react";
import { MantineProvider, Popover } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBase, IBaseProperty } from "@/ee/base/types/base.types";
import type { ResolvedPage } from "@/ee/base/queries/base-page-resolver-query";
import type { RelationTarget } from "@/ee/base/services/base-relation-service";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("@/ee/base/services/base-service", () => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  reorderProperty: vi.fn(),
  getBaseInfo: vi.fn(),
}));
vi.mock("@/ee/base/services/base-relation-service", () => ({
  searchRelationTargets: vi.fn(),
}));
vi.mock("@/ee/base/queries/page-expand-loader", () => ({
  expandPagesBatched: vi.fn(),
}));
const thisPage = vi.hoisted(() => ({ title: "Tasks" }));
vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: () => ({ data: { id: "base-1", title: thisPage.title } }),
}));

import { queryClient } from "@/main.tsx";
import { createProperty, getBaseInfo } from "@/ee/base/services/base-service";
import { searchRelationTargets } from "@/ee/base/services/base-relation-service";
import { expandPagesBatched } from "@/ee/base/queries/page-expand-loader";
import { PropertyOptions } from "./property-options";
import { CreatePropertyPopover } from "./create-property-popover";

function stubMatchMedia() {
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

const projects: RelationTarget = {
  id: "base-2",
  title: "Projects",
  icon: null,
  slugId: "p2",
  spaceId: "s1",
  spaceName: "Engineering",
  spaceSlug: "eng",
};
const reading: RelationTarget = {
  id: "base-3",
  title: "Reading list",
  icon: null,
  slugId: "p3",
  spaceId: "s2",
  spaceName: "Personal",
  spaceSlug: "me",
};
const resolvedProjects: ResolvedPage = {
  id: "base-2",
  slugId: "p2",
  title: "Projects",
  icon: null,
  spaceId: "s1",
  space: { id: "s1", slug: "eng", name: "Engineering" },
};

const draft = (typeOptions: Record<string, unknown>) =>
  ({ id: "", pageId: "base-1", name: "", type: "relation", position: "", typeOptions, isPrimary: false }) as IBaseProperty;
const stored = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    pageId: "base-1",
    name: "Project",
    type: "relation",
    position: "a",
    isPrimary: false,
    typeOptions: {
      relationId: "r1",
      targetBaseId: "base-2",
      direction: "source",
      inversePropertyId: null,
      allowMultiple: true,
      ...overrides,
    },
  }) as IBaseProperty;

const inverseProperty = { ...stored(), id: "p9", pageId: "base-2", name: "Tasks" } as IBaseProperty;
const relatedBaseInfo = (canEdit: boolean, properties: IBaseProperty[] = [inverseProperty]) =>
  ({ id: "base-2", properties, views: [], permissions: { canEdit, hasRestriction: false } }) as unknown as IBase;

function renderWithProviders(ui: ReactNode) {
  return render(
    <MantineProvider env="test">
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>,
  );
}

function renderOptions(property: IBaseProperty, hideButtons = false) {
  const onUpdate = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <PropertyOptions property={property} onUpdate={onUpdate} onClose={onClose} hideButtons={hideButtons} />,
  );
  return { onUpdate, onClose };
}

function openCreatePanel() {
  renderWithProviders(
    <CreatePropertyPopover
      pageId="base-1"
      properties={[]}
      renderTarget={(open) => (
        <button type="button" onClick={open}>
          Add property
        </button>
      )}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add property" }));
  fireEvent.click(screen.getByText("Relation"));
}

async function chooseBase(name: string) {
  fireEvent.click(screen.getByLabelText("Related base"));
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
}

const button = (name: string) => screen.getByRole("button", { name });

async function enabledSwitch(name: string) {
  const control = await screen.findByRole("switch", { name });
  await waitFor(() => expect(control).toHaveProperty("disabled", false));
  return control;
}

beforeEach(() => {
  stubMatchMedia();
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  queryClient.clear();
  thisPage.title = "Tasks";
  vi.mocked(searchRelationTargets).mockReset();
  vi.mocked(searchRelationTargets).mockImplementation(async (query) =>
    [projects, reading].filter((base) => base.title.toLowerCase().includes((query ?? "").toLowerCase())),
  );
  vi.mocked(expandPagesBatched).mockReset();
  vi.mocked(expandPagesBatched).mockImplementation(async (ids) =>
    new Map(ids.filter((id) => id === "base-2").map((id) => [id, resolvedProjects])),
  );
  vi.mocked(getBaseInfo).mockReset();
  vi.mocked(getBaseInfo).mockImplementation(async (pageId) => ({ ...relatedBaseInfo(true), id: pageId }));
  vi.mocked(createProperty).mockReset();
  vi.mocked(createProperty).mockResolvedValue(stored());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("creating a relation property", () => {
  it("create panel keeps Create disabled until a base is chosen", async () => {
    openCreatePanel();
    expect(button("Create property")).toHaveProperty("disabled", true);
    await chooseBase("Projects");
    expect(button("Create property")).toHaveProperty("disabled", false);
  });

  it("sends the related base, the other side's name and allow multiple rows", async () => {
    openCreatePanel();
    await chooseBase("Projects");
    fireEvent.click(await enabledSwitch("Show on Projects"));
    fireEvent.click(button("Create property"));
    await waitFor(() =>
      expect(createProperty).toHaveBeenCalledWith({
        pageId: "base-1",
        name: "Relation",
        type: "relation",
        typeOptions: { allowMultiple: true, targetBaseId: "base-2", twoWay: true, inverseName: "Tasks" },
      }),
    );
  });

  it("turning on Show on {{base}} reveals the name field prefilled with this base's title", async () => {
    const { onUpdate } = renderOptions(draft({ allowMultiple: true, targetBaseId: "base-2" }), true);
    const showOn = await enabledSwitch("Show on Projects");
    expect(screen.queryByRole("textbox", { name: "Name on Projects" })).toBeNull();
    fireEvent.click(showOn);
    expect(screen.getByRole("textbox", { name: "Name on Projects" })).toHaveProperty("value", "Tasks");
    expect(onUpdate).toHaveBeenLastCalledWith({
      allowMultiple: true,
      targetBaseId: "base-2",
      twoWay: true,
      inverseName: "Tasks",
    });
  });

  it("leaves a cleared name out so the server names the other side", async () => {
    const { onUpdate } = renderOptions(draft({ allowMultiple: true, targetBaseId: "base-2" }), true);
    fireEvent.click(await enabledSwitch("Show on Projects"));
    const name = screen.getByRole("textbox", { name: "Name on Projects" });
    fireEvent.change(name, { target: { value: "  " } });
    expect(name).toHaveProperty("placeholder", "Tasks");
    expect(onUpdate.mock.lastCall?.[0]).toEqual({ allowMultiple: true, targetBaseId: "base-2", twoWay: true });
  });

  it("cuts a long base title to the 255-character name limit", async () => {
    thisPage.title = "T".repeat(300);
    const { onUpdate } = renderOptions(draft({ allowMultiple: true, targetBaseId: "base-2" }), true);
    fireEvent.click(await enabledSwitch("Show on Projects"));
    expect(onUpdate.mock.lastCall?.[0].inverseName).toBe("T".repeat(255));
    expect(screen.getByRole("textbox", { name: "Name on Projects" })).toHaveProperty("maxLength", 255);
  });

  it("Show on is disabled with a reason when the user can't edit the other base", async () => {
    let resolveInfo: (info: IBase) => void = () => {};
    vi.mocked(getBaseInfo).mockReturnValue(new Promise<IBase>((resolve) => (resolveInfo = resolve)));
    const { onUpdate } = renderOptions(draft({ allowMultiple: true, targetBaseId: "base-2" }), true);
    const showOn = await screen.findByRole("switch", { name: "Show on Projects" });
    expect(showOn).toHaveProperty("disabled", true);
    expect(screen.queryByText("You can't edit Projects.")).toBeNull();
    resolveInfo(relatedBaseInfo(false));
    expect(await screen.findByText("You can't edit Projects.")).toBeTruthy();
    expect(showOn).toHaveProperty("disabled", true);
    expect(showOn).toHaveProperty("checked", false);
    expect(onUpdate.mock.lastCall?.[0]).not.toHaveProperty("twoWay", true);
    expect(screen.getByRole("switch", { name: "Allow multiple rows" })).toHaveProperty("disabled", false);
  });

  it("choosing another base turns Show on off", async () => {
    openCreatePanel();
    await chooseBase("Projects");
    fireEvent.click(await enabledSwitch("Show on Projects"));
    await chooseBase("Reading list");
    expect(await screen.findByRole("switch", { name: "Show on Reading list" })).toHaveProperty("checked", false);
    expect(screen.queryByRole("textbox", { name: /Name on/ })).toBeNull();
    fireEvent.click(button("Create property"));
    await waitFor(() =>
      expect(createProperty).toHaveBeenCalledWith({
        pageId: "base-1",
        name: "Relation",
        type: "relation",
        typeOptions: { allowMultiple: true, targetBaseId: "base-3", twoWay: false },
      }),
    );
  });

  it("shows No bases found when the search matches nothing", async () => {
    openCreatePanel();
    fireEvent.click(screen.getByLabelText("Related base"));
    fireEvent.change(screen.getByRole("textbox", { name: "Search bases" }), { target: { value: "zzz" } });
    expect(await screen.findByText("No bases found")).toBeTruthy();
    expect(searchRelationTargets).toHaveBeenCalledWith("zzz");
  });
});

describe("editing a relation property", () => {
  it("edit mode shows the related base read-only", async () => {
    renderOptions(stored());
    const related = screen.getByLabelText("Related base");
    expect(related).toHaveProperty("disabled", true);
    await waitFor(() => expect(related.textContent).toContain("Projects"));
    expect(related.textContent).toContain("Engineering");
    expect(screen.queryByRole("option")).toBeNull();
    expect(searchRelationTargets).not.toHaveBeenCalled();
  });

  it("shows No access for a related base the viewer can't open, without the other side's switch", async () => {
    renderOptions(stored({ targetBaseId: "base-4" }));
    const related = screen.getByLabelText("Related base");
    await waitFor(() => expect(related.textContent).toBe("No access"));
    expect(screen.queryByRole("switch", { name: /Show on/ })).toBeNull();
    expect(screen.getByRole("switch", { name: "Allow multiple rows" })).toBeTruthy();
  });

  it("saves only the options that changed", async () => {
    const { onUpdate, onClose } = renderOptions(stored({ inversePropertyId: "p9" }));
    await screen.findByRole("switch", { name: "Show on Projects" });
    fireEvent.click(screen.getByRole("switch", { name: "Allow multiple rows" }));
    fireEvent.click(button("Save"));
    expect(onUpdate).toHaveBeenCalledWith({ allowMultiple: false });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: /Remove from/ })).toBeNull();
  });

  it("Show on stays on, disabled with a reason, when the user can't edit the other base", async () => {
    vi.mocked(getBaseInfo).mockResolvedValue(relatedBaseInfo(false));
    renderOptions(stored({ inversePropertyId: "p9" }));
    expect(await screen.findByText("You can't edit Projects.")).toBeTruthy();
    const showOn = screen.getByRole("switch", { name: "Show on Projects" });
    expect(showOn).toHaveProperty("checked", true);
    expect(showOn).toHaveProperty("disabled", true);
    expect(button("Save")).toHaveProperty("disabled", true);
    expect(screen.getByRole("switch", { name: "Allow multiple rows" })).toHaveProperty("disabled", false);
  });

  it("asks before turning off Show on {{base}} deletes the other base's property", async () => {
    const { onUpdate, onClose } = renderOptions(stored({ inversePropertyId: "p9" }));
    fireEvent.click(await enabledSwitch("Show on Projects"));
    fireEvent.click(button("Save"));
    const dialog = await screen.findByRole("dialog", { name: "Remove from Projects" });
    expect(
      within(dialog).getByText(
        "Are you sure you want to remove this relation from Projects? Its Tasks property will be deleted.",
      ),
    ).toBeTruthy();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(onUpdate).toHaveBeenCalledWith({ twoWay: false });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("drops the property name from the question when the other base doesn't list it", async () => {
    vi.mocked(getBaseInfo).mockResolvedValue(relatedBaseInfo(true, []));
    renderOptions(stored({ inversePropertyId: "p9" }));
    fireEvent.click(await enabledSwitch("Show on Projects"));
    fireEvent.click(button("Save"));
    const dialog = await screen.findByRole("dialog", { name: "Remove from Projects" });
    expect(within(dialog).getByText("Are you sure you want to remove this relation from Projects?")).toBeTruthy();
  });

  it("keeps the options and the property menu open when the question is cancelled", async () => {
    const onMenuChange = vi.fn();
    const onUpdate = vi.fn();
    renderWithProviders(
      <Popover opened onChange={onMenuChange} closeOnClickOutside>
        <Popover.Target>
          <button type="button">Project</button>
        </Popover.Target>
        <Popover.Dropdown>
          <PropertyOptions property={stored({ inversePropertyId: "p9" })} onUpdate={onUpdate} onClose={vi.fn()} />
        </Popover.Dropdown>
      </Popover>,
    );
    fireEvent.click(await enabledSwitch("Show on Projects"));
    fireEvent.click(button("Save"));
    const dialog = await screen.findByRole("dialog", { name: "Remove from Projects" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    fireEvent.mouseDown(cancel);
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Remove from Projects" })).toBeNull());
    expect(onMenuChange).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Show on Projects" })).toHaveProperty("checked", false);
  });
});
