import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient } from "@/main.tsx";
import { getPageById } from "@/features/page/services/page-service";
import type { IPage } from "@/features/page/types/page.types";
import { invalidatePageInfo, usePageQuery } from "./page-query";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

vi.mock("@/features/page/services/page-service", () => ({
  getPageById: vi.fn(),
}));

const page = (id: string, slugId: string) => ({ id, slugId }) as IPage;

beforeEach(() => {
  queryClient.clear();
  vi.mocked(getPageById).mockReset();
});

describe("usePageQuery", () => {
  it("always asks for the draft so draft users never cache the approved version", async () => {
    vi.mocked(getPageById).mockResolvedValue(page("page-1", "slug-1"));

    renderHook(() => usePageQuery({ pageId: "slug-1" }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(getPageById).toHaveBeenCalled());
    expect(getPageById).toHaveBeenCalledWith({
      pageId: "slug-1",
      draft: true,
    });
  });
});

describe("invalidatePageInfo", () => {
  const isInvalidated = (key: string) =>
    queryClient.getQueryState(["pages", key])?.isInvalidated;

  beforeEach(() => {
    queryClient.setQueryData(["pages", "page-1"], page("page-1", "slug-1"));
    queryClient.setQueryData(["pages", "slug-1"], page("page-1", "slug-1"));
    queryClient.setQueryData(["pages", "page-2"], page("page-2", "slug-2"));
  });

  it("invalidates the entries cached under the id and the slugId of the page", () => {
    invalidatePageInfo("page-1");

    expect(isInvalidated("page-1")).toBe(true);
    expect(isInvalidated("slug-1")).toBe(true);
    expect(isInvalidated("page-2")).toBe(false);
  });

  it("matches the slugId from the event when the cached data carries no id", () => {
    queryClient.setQueryData(["pages", "slug-3"], { slugId: "slug-3" });

    invalidatePageInfo("page-3", "slug-3");

    expect(isInvalidated("slug-3")).toBe(true);
    expect(isInvalidated("page-2")).toBe(false);
  });
});
