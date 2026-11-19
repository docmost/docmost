import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/ee/base/services/base-service", () => ({
  createBase: vi.fn(),
  getBaseInfo: vi.fn(),
  updateBase: vi.fn(),
  deleteBase: vi.fn(),
  convertPageToBase: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { queryClient } from "@/main.tsx";
import { updateBase } from "@/ee/base/services/base-service";
import { useUpdateBaseMutation } from "./base-query";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useUpdateBaseMutation", () => {
  it("renames the base and keeps the cached properties, views and permissions", async () => {
    const cached = {
      id: "base-1",
      name: "Plan",
      properties: [{ id: "p1" }],
      views: [{ id: "v1" }],
      permissions: { canEdit: true, hasRestriction: false },
    };
    queryClient.setQueryData(["bases", "base-1"], cached);
    vi.mocked(updateBase).mockResolvedValue({ id: "base-1", name: "Renamed", properties: [], views: [] } as never);

    const { result } = renderHook(() => useUpdateBaseMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ pageId: "base-1", name: "Renamed" }));

    expect(updateBase).toHaveBeenCalledWith({ pageId: "base-1", name: "Renamed" });
    expect(queryClient.getQueryData(["bases", "base-1"])).toEqual({ ...cached, name: "Renamed" });
  });

  const seedRows = (pageId: string) => {
    const key = ["base-rows", pageId, "view-1"];
    queryClient.setQueryData(key, { pages: [{ items: [], meta: {} }], pageParams: [null] });
    return key;
  };
  const save = async (pageId: string, name: string) => {
    const { result } = renderHook(() => useUpdateBaseMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ pageId, name }));
  };

  it("does not refresh rows after a rename", async () => {
    vi.useFakeTimers();
    queryClient.setQueryData(["bases", "base-3"], { id: "base-3", properties: [], views: [] });
    const rowsKey = seedRows("base-3");
    vi.mocked(updateBase).mockResolvedValue({ id: "base-3", name: "Renamed" } as never);

    await save("base-3", "Renamed");
    vi.advanceTimersByTime(5000);
    expect(queryClient.getQueryState(rowsKey)?.isInvalidated).toBe(false);
  });

  it("writes no cached base and refreshes nothing when the base is not cached", async () => {
    vi.useFakeTimers();
    const rowsKey = seedRows("base-4");
    vi.mocked(updateBase).mockResolvedValue({ id: "base-4" } as never);

    await save("base-4", "Renamed");
    vi.advanceTimersByTime(5000);
    expect(queryClient.getQueryData(["bases", "base-4"])).toBeUndefined();
    expect(queryClient.getQueryState(rowsKey)?.isInvalidated).toBe(false);
  });
});
