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
vi.mock("@/ee/base/queries/rows-refresh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ee/base/queries/rows-refresh")>();
  return { ...actual, scheduleRowsRefresh: vi.fn(actual.scheduleRowsRefresh) };
});
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { queryClient } from "@/main.tsx";
import { scheduleRowsRefresh } from "@/ee/base/queries/rows-refresh";
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
  it("sends the zone and keeps the cached properties, views and permissions", async () => {
    const cached = {
      id: "base-1",
      name: "Plan",
      baseTimeZone: null,
      properties: [{ id: "p1" }],
      views: [{ id: "v1" }],
      permissions: { canEdit: true, hasRestriction: false },
    };
    queryClient.setQueryData(["bases", "base-1"], cached);
    vi.mocked(updateBase).mockResolvedValue({ id: "base-1", name: "Plan", baseTimeZone: "Europe/Berlin", properties: [], views: [] } as never);

    const { result } = renderHook(() => useUpdateBaseMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ pageId: "base-1", timeZone: "Europe/Berlin" }));

    expect(updateBase).toHaveBeenCalledWith({ pageId: "base-1", timeZone: "Europe/Berlin" });
    expect(queryClient.getQueryData(["bases", "base-1"])).toEqual({ ...cached, baseTimeZone: "Europe/Berlin" });
  });

  const seedRows = (pageId: string) => {
    const key = ["base-rows", pageId, "view-1"];
    queryClient.setQueryData(key, { pages: [{ items: [], meta: {} }], pageParams: [null] });
    return key;
  };
  const save = async (pageId: string, timeZone: string | null) => {
    const { result } = renderHook(() => useUpdateBaseMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ pageId, timeZone }));
  };

  it("refreshes the base's rows once after a change of zone", async () => {
    vi.useFakeTimers();
    queryClient.setQueryData(["bases", "base-2"], { id: "base-2", baseTimeZone: null, properties: [], views: [] });
    const rowsKey = seedRows("base-2");
    vi.mocked(updateBase).mockResolvedValue({ id: "base-2", baseTimeZone: "Europe/Berlin" } as never);

    vi.mocked(scheduleRowsRefresh).mockClear();
    await save("base-2", "Europe/Berlin");
    expect(queryClient.getQueryState(rowsKey)?.isInvalidated).toBe(false);
    vi.advanceTimersByTime(300);
    expect(queryClient.getQueryState(rowsKey)?.isInvalidated).toBe(true);
    expect(scheduleRowsRefresh).toHaveBeenCalledTimes(1);
    expect(scheduleRowsRefresh).toHaveBeenCalledWith("base-2", "all");
  });

  it("refreshes nothing when the response names the zone the base already had", async () => {
    vi.useFakeTimers();
    queryClient.setQueryData(["bases", "base-3"], { id: "base-3", baseTimeZone: "Europe/Berlin", properties: [], views: [] });
    const rowsKey = seedRows("base-3");
    vi.mocked(updateBase).mockResolvedValue({ id: "base-3", name: "Renamed", baseTimeZone: "Europe/Berlin" } as never);

    await save("base-3", "Europe/Berlin");
    vi.advanceTimersByTime(5000);
    expect(queryClient.getQueryState(rowsKey)?.isInvalidated).toBe(false);
  });

  it("writes no cached base and refreshes nothing when the base is not cached", async () => {
    vi.useFakeTimers();
    const rowsKey = seedRows("base-4");
    vi.mocked(updateBase).mockResolvedValue({ id: "base-4", baseTimeZone: "Europe/Berlin" } as never);

    await save("base-4", "Europe/Berlin");
    vi.advanceTimersByTime(5000);
    expect(queryClient.getQueryData(["bases", "base-4"])).toBeUndefined();
    expect(queryClient.getQueryState(rowsKey)?.isInvalidated).toBe(false);
  });
});
