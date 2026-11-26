import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty, RelationPreview } from "@/ee/base/types/base.types";

const relationQueries = vi.hoisted(() => ({
  candidates: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));
vi.mock("@/ee/base/queries/base-relation-query", () => ({
  useRelationCandidatesQuery: (args: unknown) => relationQueries.candidates(args),
  useUpdateRelationLinksMutation: () => ({ mutateAsync: relationQueries.mutateAsync }),
}));
vi.mock("@/ee/base/queries/base-page-resolver-query", () => ({
  useResolvedPages: () => ({ pages: new Map(), isLoading: false }),
}));

import { CellRelation } from "./cell-relation";

const property = {
  id: "rel",
  pageId: "base-1",
  name: "Projects",
  type: "relation",
  isPrimary: false,
  typeOptions: {
    relationId: "relation-1",
    targetBaseId: "b2",
    direction: "source",
    inversePropertyId: null,
    allowMultiple: true,
  },
} as unknown as IBaseProperty;

function renderCell(relation: RelationPreview | undefined, readOnly = false) {
  const onCancel = vi.fn();
  render(
    <MantineProvider env="test">
      <CellRelation
        value={undefined}
        property={property}
        rowId="r1"
        isEditing
        relation={relation}
        readOnly={readOnly}
        onCommit={vi.fn()}
        onValueChange={vi.fn()}
        onCancel={onCancel}
      />
    </MantineProvider>,
  );
  return { onCancel };
}

beforeEach(() => {
  relationQueries.candidates.mockReset();
  relationQueries.candidates.mockReturnValue({ data: { items: [], meta: {} }, error: null });
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
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(cleanup);

describe("CellRelation", () => {
  it("opens the picker while editing and Escape ends the edit", () => {
    const { onCancel } = renderCell({ count: 1, rows: [{ id: "a", title: "Alpha" }] });
    const input = screen.getByRole("combobox", { name: "Search Untitled" });

    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCancel).toHaveBeenCalled();
    expect(relationQueries.mutateAsync).not.toHaveBeenCalled();
  });

  it("never opens the picker for a restricted preview or a read-only user", () => {
    const { onCancel } = renderCell({ count: 0, rows: [], restricted: true });
    expect(screen.getByText("No access")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(onCancel).toHaveBeenCalled();
    cleanup();

    renderCell({ count: 1, rows: [{ id: "a", title: "Alpha" }] }, true);
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
