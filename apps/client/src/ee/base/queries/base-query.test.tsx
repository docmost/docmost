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

afterEach(cleanup);

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
});
