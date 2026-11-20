import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ISpace } from "@/features/space/types/space.types";
import { getSpaceById } from "@/features/space/services/space-service.ts";
import { useUnlistedSpaceQuery } from "./space-query";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

vi.mock("@/features/space/services/space-service.ts", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/space/services/space-service.ts")
  >()),
  getSpaceById: vi.fn(),
}));

const listed = { id: "space-1", slug: "eng", name: "Engineering" } as ISpace;
const archived = {
  id: "space-2",
  slug: "old",
  name: "Old projects",
  archivedAt: new Date("2026-11-01T00:00:00Z"),
} as ISpace;

function renderUnlisted(spaceId: string | null, spaces: ISpace[] | undefined) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUnlistedSpaceQuery(spaceId, spaces), { wrapper });
}

describe("useUnlistedSpaceQuery", () => {
  beforeEach(() => {
    vi.mocked(getSpaceById).mockReset();
    vi.mocked(getSpaceById).mockResolvedValue(archived);
  });

  it("does not fetch a space the list already has", () => {
    const { result } = renderUnlisted("space-1", [listed]);

    expect(result.current.fetchStatus).toBe("idle");
    expect(getSpaceById).not.toHaveBeenCalled();
  });

  it("fetches a space the list does not have", async () => {
    const { result } = renderUnlisted("space-2", [listed]);

    await waitFor(() => expect(result.current.data).toEqual(archived));
    expect(getSpaceById).toHaveBeenCalledWith("space-2");
  });

  it("waits for the list before fetching", () => {
    const { result } = renderUnlisted("space-2", undefined);

    expect(result.current.fetchStatus).toBe("idle");
    expect(getSpaceById).not.toHaveBeenCalled();
  });
});
