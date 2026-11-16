import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IUser } from "@/features/user/types/user.types";
import { useSyncUserTimezone } from "./use-sync-user-timezone";

const updateUser = vi.fn();

vi.mock("@/features/user/services/user-service", () => ({
  updateUser: (data: unknown) => updateUser(data),
}));

function stubBrowserZone(timeZone: string | undefined) {
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone }) }) as Intl.DateTimeFormat,
  );
}

function renderSync(user: Partial<IUser>, queryClient = new QueryClient()) {
  const wrapper = ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSyncUserTimezone(user as IUser), { wrapper });
}

describe("useSyncUserTimezone", () => {
  beforeEach(() => {
    updateUser.mockReset();
    updateUser.mockResolvedValue({ timezone: "Europe/Berlin" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves the browser zone when none is stored", async () => {
    stubBrowserZone("Europe/Berlin");
    const queryClient = new QueryClient();
    queryClient.setQueryData(["currentUser"], {
      user: { id: "u1", timezone: null },
      workspace: { id: "w1" },
    });

    renderSync({ id: "u1", timezone: null }, queryClient);

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({ timezone: "Europe/Berlin" }),
    );
    expect(updateUser).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        (queryClient.getQueryData(["currentUser"]) as any).user.timezone,
      ).toBe("Europe/Berlin"),
    );
  });

  it("does nothing when the stored zone matches", () => {
    stubBrowserZone("Europe/Berlin");

    renderSync({ id: "u1", timezone: "Europe/Berlin" });

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("does nothing when the browser zone cannot be resolved", () => {
    stubBrowserZone(undefined);

    renderSync({ id: "u1", timezone: null });

    expect(updateUser).not.toHaveBeenCalled();
  });
});
