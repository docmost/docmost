import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/ee/base/services/base-service", () => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  reorderProperty: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { queryClient } from "@/main.tsx";
import { updateProperty } from "@/ee/base/services/base-service";
import { useUpdatePropertyMutation } from "./base-property-query";

const ROWS = ["base-rows", "base-1", undefined, undefined];
const BASE = ["bases", "base-1"];
const due = (typeOptions: object, pending: object = {}) =>
  ({ id: "p1", pageId: "base-1", name: "Due", type: "date", typeOptions, ...pending }) as never;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

async function update(stored: object, result: { property: never; jobId: string | null }) {
  queryClient.clear();
  queryClient.setQueryData(BASE, { id: "base-1", properties: [due(stored)], views: [] });
  queryClient.setQueryData(ROWS, { pages: [], pageParams: [] });
  vi.mocked(updateProperty).mockResolvedValue(result);
  const { result: hook } = renderHook(() => useUpdatePropertyMutation(), { wrapper });
  await act(() => hook.current.mutateAsync({ propertyId: "p1", pageId: "base-1", typeOptions: {} }));
}

const rowsInvalidated = () => queryClient.getQueryState(ROWS)?.isInvalidated;

beforeEach(() => vi.mocked(updateProperty).mockReset());
afterEach(cleanup);

describe("useUpdatePropertyMutation", () => {
  it("refetches rows after a kind change that was converted at once", async () => {
    await update({}, { property: due({ includeTime: true }), jobId: null });
    expect(rowsInvalidated()).toBe(true);
  });

  it("waits for the worker when the kind change was queued, and keeps the pending state", async () => {
    const pending = { pendingType: "date", pendingTypeOptions: { includeTime: false } };
    await update({ includeTime: true }, { property: due({ includeTime: true }, pending), jobId: "42" });
    expect(rowsInvalidated()).toBe(false);
    expect(queryClient.getQueryData<{ properties: object[] }>(BASE)?.properties[0]).toMatchObject(pending);
  });

  it("does not refetch rows for a format change", async () => {
    await update({ includeTime: true }, { property: due({ includeTime: true, dateFormat: "full" }), jobId: null });
    expect(rowsInvalidated()).toBe(false);
  });
});
