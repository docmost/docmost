import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import App from "@/App";

vi.mock("@/components/layouts/global/layout.tsx", () => ({
  default: () => <Outlet />,
}));
vi.mock("@/features/workspace/components/workspace-locale-layout.tsx", () => ({
  default: () => <Outlet />,
}));
vi.mock("@/pages/page/page-route", () => ({ PageRoute: () => null }));
vi.mock("@/ee/hooks/use-redirect-to-cloud-select.tsx", () => ({
  useRedirectToCloudSelect: () => {},
}));
vi.mock("@/hooks/use-track-origin", () => ({ useTrackOrigin: () => {} }));
vi.mock("@/ee/announcement/components/announcement-banners.tsx", () => ({
  default: () => null,
}));
vi.mock("@/components/ui/error-404.tsx", () => ({
  Error404: () => "Page not found",
}));
vi.mock("@/ee/confluence-import/pages/confluence-import.tsx", () => ({
  default: () => "Import from Confluence",
}));

afterEach(() => vi.unstubAllEnvs());

it.each([
  [undefined, "Page not found"],
  ["false", "Page not found"],
  ["invalid", "Page not found"],
  ["true", "Import from Confluence"],
  ["TRUE", "Import from Confluence"],
] as const)("resolves the import settings URL with the flag set to %s", async (flag, page) => {
  vi.stubEnv("BETA_CONFLUENCE_IMPORTER", flag);
  render(
    <MemoryRouter initialEntries={["/settings/import/confluence"]}>
      <App />
    </MemoryRouter>,
  );
  expect(await screen.findByText(page)).toBeTruthy();
});
