import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SwitchSpace } from "./switch-space.tsx";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const SPACES = [
  { id: "1", name: "General", slug: "general", logo: null },
  { id: "2", name: "Engineering", slug: "engineering", logo: null },
  { id: "3", name: "Marketing", slug: "marketing", logo: null },
];

vi.mock("@/features/space/services/space-service.ts", () => ({
  getSpaces: vi.fn(async () => ({ items: SPACES, meta: {} })),
  getSpaceById: vi.fn(),
  getSpaceMembers: vi.fn(),
  addSpaceMember: vi.fn(),
  changeMemberRole: vi.fn(),
  removeSpaceMember: vi.fn(),
  createSpace: vi.fn(),
  updateSpace: vi.fn(),
  deleteSpace: vi.fn(),
}));

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver;
  Element.prototype.scrollIntoView = () => {};
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderSwitcher() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/s/general"]}>
          <SwitchSpace spaceName="General" spaceSlug="general" />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

function getOption(name: string) {
  const options = screen.getAllByRole("option", { hidden: true });
  const match = options.find((option) => option.textContent?.includes(name));
  if (!match) {
    throw new Error(`option ${name} not found`);
  }
  return match;
}

async function openSwitcher() {
  fireEvent.click(screen.getByRole("button", { name: /general/i }));
  const dialog = await screen.findByRole("dialog", { hidden: true });
  await screen.findAllByRole("option", { hidden: true });
  return dialog;
}

describe("SwitchSpace", () => {
  it("renders the space options inside the popover so option clicks are not outside clicks", async () => {
    renderSwitcher();
    const dialog = await openSwitcher();
    const listbox = screen.getByRole("listbox", { hidden: true });
    expect(dialog.contains(listbox)).toBe(true);
  });

  it("keeps the popover open when an option is pressed with the mouse", async () => {
    renderSwitcher();
    const dialog = await openSwitcher();
    fireEvent.mouseDown(getOption("Marketing"));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(document.body.contains(dialog)).toBe(true);
  });

  it("navigates to the space picked from search results", async () => {
    renderSwitcher();
    await openSwitcher();
    fireEvent.change(screen.getByPlaceholderText("Search for spaces"), {
      target: { value: "mark" },
    });
    await waitFor(() => getOption("Marketing"));
    const option = getOption("Marketing");
    fireEvent.mouseDown(option);
    fireEvent.mouseUp(option);
    fireEvent.click(option);
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/s/marketing"),
    );
  });
});
