import { QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/ee/base/services/base-relation-service", () => ({
  updateRelationLinks: vi.fn(),
  listRelationRows: vi.fn(),
  searchRelationCandidates: vi.fn(),
  resolveRelationRows: vi.fn(),
  fetchRelationPreviews: vi.fn(),
  searchRelationTargets: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { queryClient } from "@/main.tsx";
import { updateRelationLinks } from "@/ee/base/services/base-relation-service";
import type { IBaseRow, RelationPreview } from "@/ee/base/types/base.types";
import {
  patchRelationPreviews,
  useUpdateRelationLinksMutation,
} from "./base-relation-query";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const preview = (count: number): RelationPreview => ({
  count,
  rows: Array.from({ length: count }, (_, i) => ({ id: `t${i}`, title: `T${i}` })),
});
const row = (id: string, relations?: Record<string, RelationPreview>) =>
  ({ id, pageId: "p1", cells: {}, position: id, relations }) as unknown as IBaseRow;
const seed = (rows: IBaseRow[]) =>
  queryClient.setQueryData<InfiniteData<{ items: IBaseRow[]; meta: object }>>(
    ["base-rows", "p1", "view-1"],
    { pages: [{ items: rows, meta: {} }], pageParams: [null] },
  );
const cachedRows = () =>
  queryClient.getQueryData<InfiniteData<{ items: IBaseRow[] }>>(["base-rows", "p1", "view-1"])!
    .pages[0].items;

beforeEach(() => {
  queryClient.clear();
  vi.mocked(updateRelationLinks).mockReset();
});
afterEach(cleanup);

describe("relation queries", () => {
  it("update mutation writes the returned preview into cached rows", async () => {
    seed([row("r1", { rel: preview(0) }), row("r2")]);
    queryClient.setQueryData(["base-row", "p1", "r1"], row("r1"));
    vi.mocked(updateRelationLinks).mockResolvedValue({ preview: preview(2) });

    const { result } = renderHook(() => useUpdateRelationLinksMutation("p1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ rowId: "r1", propertyId: "rel", add: ["t0", "t1"] });
    });

    expect(updateRelationLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: "p1",
        rowId: "r1",
        propertyId: "rel",
        add: ["t0", "t1"],
        requestId: expect.any(String),
      }),
    );
    await waitFor(() => expect(cachedRows()[0].relations?.rel).toEqual(preview(2)));
    expect(cachedRows()[1].relations).toBeUndefined();
    expect(queryClient.getQueryData<IBaseRow>(["base-row", "p1", "r1"])?.relations?.rel).toEqual(
      preview(2),
    );
  });

  it("patchRelationPreviews only touches listed rows and properties", () => {
    seed([row("r1", { a: preview(1), b: preview(1) }), row("r2", { a: preview(1) })]);

    patchRelationPreviews(queryClient, "p1", { r1: { a: preview(3) } });

    const [r1, r2] = cachedRows();
    expect(r1.relations?.a).toEqual(preview(3));
    expect(r1.relations?.b).toEqual(preview(1));
    expect(r2.relations?.a).toEqual(preview(1));
  });
});
