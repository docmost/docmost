import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
const { getPageById } = vi.hoisted(() => ({ getPageById: vi.fn() }));
vi.mock("@/features/page/services/page-service.ts", () => ({ getPageById }));

import { queryClient } from "@/main.tsx";
import { usePagePrefetch } from "./use-page-prefetch";

const page = { id: "page-1", slugId: "Abc123", title: "Roadmap" };

beforeEach(() => {
  vi.useFakeTimers();
  queryClient.clear();
  getPageById.mockReset().mockResolvedValue(page);
});

afterEach(() => {
  vi.useRealTimers();
});

it("fetches a hovered page once the pointer rests and files it under its slug too", async () => {
  const { result } = renderHook(() => usePagePrefetch());
  act(() => result.current.prefetch("page-1"));
  expect(getPageById).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150);
  });
  expect(getPageById).toHaveBeenCalledExactlyOnceWith({ pageId: "page-1" });
  expect(queryClient.getQueryData(["pages", "page-1"])).toEqual(page);
  expect(queryClient.getQueryData(["pages", "Abc123"])).toEqual(page);
});

it("sends nothing when the pointer leaves before the delay", async () => {
  const { result } = renderHook(() => usePagePrefetch());
  act(() => result.current.prefetch("page-1"));
  act(() => result.current.cancel());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(getPageById).not.toHaveBeenCalled();
});

it("reuses a page that is already cached", async () => {
  queryClient.setQueryData(["pages", "page-1"], page);
  const { result } = renderHook(() => usePagePrefetch());
  act(() => result.current.prefetch("page-1"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150);
  });
  expect(getPageById).not.toHaveBeenCalled();
});
