import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
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
import {
  searchRelationCandidates,
  updateRelationLinks,
} from "@/ee/base/services/base-relation-service";
import type { IBaseRow, RelationPreview } from "@/ee/base/types/base.types";
import {
  patchRelationPreviews,
  useRelationCandidatesInfiniteQuery,
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
  vi.mocked(searchRelationCandidates).mockReset();
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

    // no request id, so this tab also takes the live event for the other rows the change touched
    expect(updateRelationLinks).toHaveBeenCalledWith({
      pageId: "p1",
      rowId: "r1",
      propertyId: "rel",
      add: ["t0", "t1"],
    });
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

  it("a link change marks that row's candidate searches stale", async () => {
    const searchKey = (rowId: string, query: string) =>
      ["base-relations", "candidates", "p1", "rel", rowId, query];
    for (const key of [searchKey("r1", ""), searchKey("r1", "al"), searchKey("r2", "")]) {
      queryClient.setQueryData(key, { items: [], meta: {} });
    }
    vi.mocked(updateRelationLinks).mockResolvedValue({ preview: preview(1) });

    const { result } = renderHook(() => useUpdateRelationLinksMutation("p1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ rowId: "r1", propertyId: "rel", add: ["t0"] });
    });

    expect(queryClient.getQueryState(searchKey("r1", ""))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(searchKey("r1", "al"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(searchKey("r2", ""))?.isInvalidated).toBe(false);
  });

  it("a stale candidate search refetches when the picker opens again", async () => {
    // the app's client never refetches on mount by default
    const client = new QueryClient({
      defaultOptions: { queries: { refetchOnMount: false, retry: false } },
    });
    const key = ["base-relations", "candidates", "p1", "rel", "r1", ""];
    client.setQueryData(key, {
      pages: [{ items: [{ id: "t0", title: "T0", linked: false }], meta: {} }],
      pageParams: [undefined],
    });
    await client.invalidateQueries({ queryKey: key, refetchType: "none" });
    vi.mocked(searchRelationCandidates).mockResolvedValue({
      items: [{ id: "t0", title: "T0", linked: true }],
      meta: { limit: 25, hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null },
    });

    const { result } = renderHook(
      () =>
        useRelationCandidatesInfiniteQuery({
          pageId: "p1",
          propertyId: "rel",
          rowId: "r1",
          query: "",
          enabled: true,
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    await waitFor(() => expect(result.current.data?.[0].linked).toBe(true));
  });

  it("candidate pages continue from the last page's cursor", async () => {
    const meta = (nextCursor: string | null) => ({
      limit: 25,
      hasNextPage: nextCursor !== null,
      hasPrevPage: false,
      nextCursor,
      prevCursor: null,
    });
    vi.mocked(searchRelationCandidates)
      .mockResolvedValueOnce({ items: [{ id: "t0", title: "T0" }], meta: meta("c1") })
      .mockResolvedValueOnce({ items: [{ id: "t1", title: "T1" }], meta: meta(null) });

    const { result } = renderHook(
      () =>
        useRelationCandidatesInfiniteQuery({
          pageId: "p1",
          propertyId: "rel",
          query: "be",
          enabled: true,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(searchRelationCandidates).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageId: "p1", propertyId: "rel", query: "be", cursor: "c1" }),
    );
    await waitFor(() => expect(result.current.data?.map((row) => row.id)).toEqual(["t0", "t1"]));
    expect(result.current.hasNextPage).toBe(false);
  });
});
