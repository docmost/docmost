import { afterEach, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { IUser } from "@/features/user/types/user.types";
import { searchSuggestions } from "@/features/search/services/search-service";
import { usePersonSearch } from "./use-person-search";

vi.mock("@/features/search/services/search-service", () => ({
  searchSuggestions: vi.fn(),
}));

afterEach(cleanup);

it("keeps historical filter results separate from active-only picker results", async () => {
  const active = { id: "active", name: "Ada" } as IUser;
  const deactivated = { id: "deactivated", name: "Adam" } as IUser;
  vi.mocked(searchSuggestions).mockImplementation(async (params) => ({
    users: params.includeDeactivatedUsers ? [active, deactivated] : [active],
  }));

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () => ({
      filter: usePersonSearch("Ad", true, { includeDeactivatedUsers: true }),
      picker: usePersonSearch("Ad", true),
    }),
    { wrapper },
  );

  try {
    await waitFor(() => {
      expect(result.current.filter).toEqual([active, deactivated]);
      expect(result.current.picker).toEqual([active]);
    });
    expect(searchSuggestions).toHaveBeenCalledTimes(2);
  } finally {
    unmount();
    client.clear();
  }
});
