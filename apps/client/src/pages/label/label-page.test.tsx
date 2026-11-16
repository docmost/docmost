import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useLabelPagesQuery } from "@/features/label/queries/label-query.ts";
import LabelPage from "./label-page";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (value: string) => value,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/components/ui/document-title.tsx", () => ({
  DocumentTitle: () => null,
}));

vi.mock("@/features/label/queries/label-query.ts", () => ({
  useLabelPagesQuery: vi.fn(() => ({
    data: { pages: [] },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  })),
}));

vi.mock("@/features/space/queries/space-query.ts", () => ({
  useGetSpacesQuery: () => ({
    data: { items: [{ id: "space-1", name: "Engineering" }] },
  }),
  useUnlistedSpaceQuery: (spaceId: string | null) => ({
    data:
      spaceId === "space-2"
        ? { id: "space-2", name: "Old projects", archivedAt: new Date() }
        : undefined,
  }),
}));

vi.mock("@/features/space/components/space-filter-menu.tsx", () => ({
  SpaceFilterMenu: ({
    onChange,
    children,
  }: {
    onChange: (spaceId: string | null) => void;
    children: ReactNode;
  }) => (
    <>
      {children}
      <button type="button" onClick={() => onChange(null)}>
        Choose all spaces
      </button>
    </>
  ),
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

function LocationProbe() {
  const location = useLocation();
  return <output>{location.pathname + location.search}</output>;
}

function renderLabelPage(url: string) {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/labels/:labelName"
            element={
              <>
                <LabelPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

const lastSpaceFilter = () =>
  vi.mocked(useLabelPagesQuery).mock.lastCall?.[2];

describe("LabelPage space filter", () => {
  beforeEach(() => {
    setMediaMatch();
    vi.mocked(useLabelPagesQuery).mockClear();
  });
  afterEach(() => {
    cleanup();
  });

  it("filters by the space in the URL", () => {
    renderLabelPage("/labels/roadmap?spaceId=space-2");

    expect(screen.getByRole("button", { name: "Old projects" })).toBeTruthy();
    expect(lastSpaceFilter()).toBe("space-2");
  });

  it("drops the filter when a link leaves the space out of the URL", () => {
    renderLabelPage("/labels/roadmap?spaceId=space-2");

    fireEvent.click(screen.getByRole("link", { name: "roadmap" }));

    expect(screen.getByRole("status").textContent).toBe("/labels/roadmap");
    expect(screen.getByRole("button", { name: "All spaces" })).toBeTruthy();
    expect(lastSpaceFilter()).toBeUndefined();
  });

  it("writes the chosen space filter to the URL", () => {
    renderLabelPage("/labels/roadmap?spaceId=space-2");

    fireEvent.click(screen.getByRole("button", { name: "Choose all spaces" }));

    expect(screen.getByRole("status").textContent).toBe("/labels/roadmap");
    expect(screen.getByRole("button", { name: "All spaces" })).toBeTruthy();
    expect(lastSpaceFilter()).toBeUndefined();
  });
});
