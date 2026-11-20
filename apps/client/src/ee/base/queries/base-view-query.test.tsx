import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBase, IBaseView } from "@/ee/base/types/base.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/ee/base/services/base-service", () => ({
  createView: vi.fn(),
  updateView: vi.fn(),
  deleteView: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { queryClient } from "@/main.tsx";
import { updateView } from "@/ee/base/services/base-service";
import { useUpdateCalendarConfig, useUpdateViewMutation } from "./base-view-query";

const BASE = ["bases", "base-1"];
const calendarView = (calendar: object) =>
  ({ id: "v1", pageId: "base-1", name: "Calendar", type: "calendar", config: { calendar, visiblePropertyIds: ["p2"] } }) as unknown as IBaseView;
const cachedConfig = () => queryClient.getQueryData<IBase>(BASE)?.views[0].config;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient.clear();
  vi.mocked(updateView).mockReset();
  queryClient.setQueryData(BASE, { id: "base-1", properties: [], views: [calendarView({ datePropertyId: "due", layout: "month" })] });
});
afterEach(cleanup);

describe("useUpdateCalendarConfig", () => {
  it("sends only the changed keys and keeps the others on screen while it waits", async () => {
    let finish!: (view: IBaseView) => void;
    vi.mocked(updateView).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useUpdateCalendarConfig("base-1", "v1"), { wrapper });

    act(() => result.current({ showWeekends: false }));
    await waitFor(() =>
      expect(updateView).toHaveBeenCalledWith({ viewId: "v1", pageId: "base-1", config: { calendar: { showWeekends: false } } }),
    );
    expect(cachedConfig()).toEqual({
      calendar: { datePropertyId: "due", layout: "month", showWeekends: false },
      visiblePropertyIds: ["p2"],
    });

    await act(async () => finish(calendarView({ datePropertyId: "due", layout: "week", showWeekends: false })));
    await waitFor(() => expect(cachedConfig()?.calendar).toEqual({ datePropertyId: "due", layout: "week", showWeekends: false }));
  });

  it("puts the stored settings back when the request fails", async () => {
    vi.mocked(updateView).mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useUpdateCalendarConfig("base-1", "v1"), { wrapper });
    act(() => result.current({ layout: "week" }));
    await waitFor(() => expect(updateView).toHaveBeenCalled());
    await waitFor(() => expect(cachedConfig()?.calendar).toEqual({ datePropertyId: "due", layout: "month" }));
  });
});

describe("useUpdateViewMutation", () => {
  it("still replaces every other config key whole and removes a key sent as null", async () => {
    vi.mocked(updateView).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useUpdateViewMutation(), { wrapper });
    act(() => result.current.mutate({ viewId: "v1", pageId: "base-1", config: { visiblePropertyIds: ["p3"], calendar: null } }));
    await waitFor(() => expect(cachedConfig()).toEqual({ visiblePropertyIds: ["p3"] }));
  });
});
