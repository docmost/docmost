import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/ee/base/services/base-service", () => ({
  listRows: vi.fn(),
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
  deleteRows: vi.fn(),
  getRowInfo: vi.fn(),
  reorderRow: vi.fn(),
}));
vi.mock("@/ee/base/queries/rows-refresh", () => ({
  scheduleRowsRefresh: vi.fn(),
  cancelRowsRefresh: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));

import { queryClient } from "@/main.tsx";
import { updateRow } from "@/ee/base/services/base-service";
import { scheduleRowsRefresh } from "@/ee/base/queries/rows-refresh";
import { useUpdateRowMutation } from "./base-row-query";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const page = (ids: string[], meta: object = {}) => ({
  items: ids.map((id) => ({ id, pageId: "p1", cells: {}, position: id })),
  meta: { nextCursor: null, ...meta },
});

beforeEach(() => {
  queryClient.clear();
  vi.mocked(scheduleRowsRefresh).mockClear();
});
afterEach(cleanup);

describe("row mutations and the refresh scheduler", () => {
  it("asks for one refresh of all rows when a row update cancels a running refetch", async () => {
    const LIST = ["base-rows", "p1", undefined, undefined];
    queryClient.setQueryData(LIST, { pages: [page(["r1"])], pageParams: [undefined] });
    queryClient
      .fetchQuery({ queryKey: LIST, queryFn: () => new Promise(() => {}), staleTime: 0 })
      .catch(() => undefined);
    expect(queryClient.isFetching({ queryKey: LIST })).toBe(1);
    vi.mocked(updateRow).mockResolvedValue({ id: "r1", pageId: "p1", cells: { a: 1 }, position: "r1" } as never);

    const { result } = renderHook(() => useUpdateRowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ rowId: "r1", pageId: "p1", cells: { a: 1 } }));

    expect(scheduleRowsRefresh).toHaveBeenCalledTimes(1);
    expect(scheduleRowsRefresh).toHaveBeenCalledWith("p1", "all");
    expect(queryClient.isFetching({ queryKey: LIST })).toBe(0);
  });
});
