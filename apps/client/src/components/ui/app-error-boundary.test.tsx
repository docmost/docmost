import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./app-error-boundary.tsx";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (value: string) => value }),
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

function Broken(): never {
  throw new TypeError("Failed to fetch dynamically imported module");
}

function renderAt(path: string) {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[path]}>
        <Link to="/home">Home</Link>
        <AppErrorBoundary>
          <Routes>
            <Route path="/broken" element={<Broken />} />
            <Route path="/home" element={<p>Home page</p>} />
          </Routes>
        </AppErrorBoundary>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("AppErrorBoundary", () => {
  beforeAll(() => {
    setMediaMatch();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders its children when nothing throws", () => {
    renderAt("/home");
    expect(screen.getByText("Home page")).toBeTruthy();
  });

  it("shows a reload prompt and keeps siblings mounted when a route throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderAt("/broken");
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("recovers when the user navigates elsewhere", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderAt("/broken");
    fireEvent.click(screen.getByText("Home"));
    expect(screen.getByText("Home page")).toBeTruthy();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });
});
