import { MantineProvider } from "@mantine/core";
import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { queryClient } from "@/main.tsx";
import PageHeaderMenu from "./page-header-menu";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

beforeAll(() => {
  onlineManager.setOnline(false);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterAll(() => {
  queryClient.clear();
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

it("opens a page with no recorded last editor", () => {
  queryClient.setQueryData(["pages", "archivednotes"], {
    id: "page-id",
    slugId: "archivednotes",
    title: "Archived notes",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUpdatedBy: null,
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <MemoryRouter initialEntries={["/archivednotes"]}>
          <Routes>
            <Route path="/:pageSlug" element={<PageHeaderMenu readOnly />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("button", { name: "Page actions" })).toBeTruthy();
});
