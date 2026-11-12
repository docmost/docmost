import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBase, IBaseView } from "@/ee/base/types/base.types";

const editable = vi.hoisted(() => ({ current: true }));

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
vi.mock("@/ee/base/context/base-editable", () => ({
  useBaseEditable: () => editable.current,
}));
vi.mock("@/ee/security/hooks/use-export-disabled", () => ({
  useExportDisabled: () => ({ exportDisabled: false, exportDisabledLabel: null }),
}));
vi.mock("@/ee/security/hooks/use-disable-print", () => ({ useDisablePrint: () => {} }));
vi.mock("@/ee/base/components/views/view-tabs", () => ({ ViewTabs: () => null }));

import { queryClient } from "@/main.tsx";
import { BaseToolbar } from "./base-toolbar";

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

const view = { id: "view-1", pageId: "base-1", name: "Table", type: "table", config: {} } as unknown as IBaseView;
const base = { id: "base-1", spaceId: "space-1", name: "Plan", baseTimeZone: null, properties: [], views: [view] } as unknown as IBase;

function renderToolbar() {
  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <BaseToolbar
          base={base}
          activeView={view}
          views={[view]}
          onViewChange={vi.fn()}
          onPersistViewConfig={vi.fn()}
          onDraftSortsChange={vi.fn()}
          onDraftFiltersChange={vi.fn()}
        />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

beforeEach(stubMatchMedia);
afterEach(cleanup);

describe("BaseToolbar", () => {
  it("offers Base settings to someone who can edit the base", () => {
    editable.current = true;
    renderToolbar();
    expect(screen.getByRole("button", { name: "Base settings" })).toBeTruthy();
  });

  it("offers no Base settings to a viewer", () => {
    editable.current = false;
    renderToolbar();
    expect(screen.queryByRole("button", { name: "Base settings" })).toBeNull();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeTruthy();
  });
});
