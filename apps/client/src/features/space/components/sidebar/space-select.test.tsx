import { useState, type ReactElement } from "react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  getSpaceById,
  getSpaces,
} from "@/features/space/services/space-service";
import type { ISpace } from "@/features/space/types/space.types";
import { SpaceSelect } from "./space-select";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/features/space/services/space-service", () => ({
  getSpaceById: vi.fn(),
  getSpaces: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name: string }) =>
      key.replace("{{name}}", options?.name ?? ""),
  }),
}));

const team = {
  id: "09c81969-06fe-40ad-a6f3-f0c244270822",
  slug: "team",
  name: "Team Space",
} as ISpace;
const design = {
  id: "aef405b8-0969-479c-a433-513b47661a2a",
  slug: "design",
  name: "Design",
  logo: "design.png",
} as ISpace;
const research = {
  id: "3b7528f4-7a77-440e-adbe-fd03c36b7b33",
  slug: "research",
  name: "Research",
  logo: "research.png",
} as ISpace;

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
  HTMLElement.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => {
  vi.mocked(getSpaces).mockImplementation(async ({ query, status }) => ({
    items:
      query === "Design"
        ? [design]
        : status === "active"
          ? [team]
          : [team, research],
    meta: {
      limit: 50,
      hasNextPage: false,
      hasPrevPage: false,
      nextCursor: null,
      prevCursor: null,
    },
  }));
  vi.mocked(getSpaceById).mockImplementation(async (id) =>
    id === research.id ? research : design,
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function show(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider env="test">{ui}</MantineProvider>
    </QueryClientProvider>,
  );
}

function Filter({
  saved,
  onChange = () => {},
  maxValues = 100,
}: {
  saved: string[];
  onChange?: (value: string[]) => void;
  maxValues?: number;
}) {
  const [value, setValue] = useState(saved);
  return (
    <SpaceSelect
      multiple
      label="Spaces"
      scopes={[{ value: "@self", label: "Current space" }]}
      value={value}
      maxValues={maxValues}
      withinPortal={false}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function search(input: HTMLElement, value: string) {
  act(() => input.focus());
  fireEvent.input(input, {
    inputType: "insertText",
    data: value,
    target: { value },
  });
}

function pill(label: string) {
  return screen.getByRole("button", { name: `Remove ${label}` }).parentElement;
}

it("restores a saved space beyond the first page and keeps selections and their icons while searching", async () => {
  const saved = [research.id, "@self", "?legacy"];
  const onChange = vi.fn();
  const view = show(<Filter saved={saved} onChange={onChange} />);
  await screen.findByRole("button", { name: "Remove Research" });
  expect(pill("Research").querySelector("img")?.src).toContain(
    "/space-icon/research.png",
  );
  expect(getSpaceById).toHaveBeenCalledExactlyOnceWith(research.id);

  const input = screen.getByRole("combobox", { name: "Spaces" });
  act(() => input.focus());
  const teamOption = await screen.findByRole("option", { name: team.name });
  expect(teamOption.textContent).toContain("TS");
  const teamIconStyle = teamOption
    .querySelector("[aria-hidden]")
    ?.getAttribute("style");
  fireEvent.click(teamOption);
  expect(pill("Team Space").textContent).toContain("TS");
  expect(
    pill("Team Space").querySelector("[aria-hidden]")?.getAttribute("style"),
  ).toBe(teamIconStyle);
  search(input, "Design");
  const option = await screen.findByRole("option", { name: "Design" });
  expect(option.querySelector("img")?.src).toContain("/space-icon/design.png");
  fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  expect(onChange).toHaveBeenLastCalledWith([...saved, team.id, design.id]);

  search(input, "Team");
  await waitFor(() =>
    expect(getSpaces).toHaveBeenCalledWith(
      expect.objectContaining({ query: "Team" }),
    ),
  );
  expect(screen.queryByRole("option", { name: "Team Space" })).toBeNull();
  expect(pill("Design").querySelector("img")?.src).toContain(
    "/space-icon/design.png",
  );
  expect(pill("Research").querySelector("img")?.src).toContain(
    "/space-icon/research.png",
  );
  expect(getSpaceById).toHaveBeenCalledExactlyOnceWith(research.id);
  fireEvent.click(screen.getByRole("button", { name: "Remove ?legacy" }));
  const updated = [research.id, "@self", team.id, design.id];
  expect(onChange).toHaveBeenLastCalledWith(updated);

  view.unmount();
  show(<Filter saved={updated} />);
  await screen.findByRole("button", { name: "Remove Design" });
  expect(pill("Design").querySelector("img")?.src).toContain(
    "/space-icon/design.png",
  );
  expect(pill("Research").querySelector("img")?.src).toContain(
    "/space-icon/research.png",
  );
});

it("waits for an oversized filter to be repaired and keeps inaccessible spaces removable", async () => {
  vi.mocked(getSpaceById).mockRejectedValueOnce(new Error("Forbidden"));
  const onChange = vi.fn();
  show(
    <Filter
      saved={[research.id, "?legacy"]}
      maxValues={1}
      onChange={onChange}
    />,
  );
  const input = screen.getByRole("combobox", { name: "Spaces" });
  act(() => input.focus());
  await screen.findByRole("option", { name: "Team Space" });
  expect(getSpaceById).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Backspace" });
  await waitFor(() =>
    expect(getSpaceById).toHaveBeenCalledExactlyOnceWith(research.id),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Remove " + research.id }),
  );
  expect(onChange).toHaveBeenLastCalledWith([]);
});

it("keeps the single picker slug-based, excluding the current space and selecting earlier results", async () => {
  const onChange = vi.fn();
  show(
    <SpaceSelect
      value={research.slug}
      onChange={onChange}
      opened
      withinPortal={false}
    />,
  );
  const input = screen.getByRole("combobox");
  await screen.findByRole("option", { name: team.name });
  search(input, "Design");
  await screen.findByRole("option", { name: design.name });
  search(input, "");
  fireEvent.click(await screen.findByRole("option", { name: team.name }));
  await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith(team));
  expect(screen.queryByRole("option", { name: research.name })).toBeNull();
  expect(getSpaceById).not.toHaveBeenCalled();
});
