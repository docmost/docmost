import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { ISpace } from "@/features/space/types/space.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

const { applySpaceArchiveChange } = await import("./space-query");

describe("applySpaceArchiveChange", () => {
  it("marks every cached copy of the space and refreshes the space lists", () => {
    const queryClient = new QueryClient();
    const space = { id: "space-1", slug: "eng", archivedAt: null } as ISpace;
    const other = { id: "space-2", slug: "ops", archivedAt: null } as ISpace;
    queryClient.setQueryData(["space", "space-1"], space);
    queryClient.setQueryData(["space", "eng"], space);
    queryClient.setQueryData(["space", "space-2"], other);
    queryClient.setQueryData(["spaces", { page: 1 }], { items: [space, other] });
    queryClient.setQueryData(["favorites", "spaces"], []);
    queryClient.setQueryData(["spaceMembers", "space-1", ""], []);

    const archivedAt = new Date("2026-11-04T10:00:00Z");
    applySpaceArchiveChange(queryClient, "space-1", archivedAt);

    expect(queryClient.getQueryData<ISpace>(["space", "space-1"])?.archivedAt).toEqual(archivedAt);
    expect(queryClient.getQueryData<ISpace>(["space", "eng"])?.archivedAt).toEqual(archivedAt);
    expect(queryClient.getQueryData<ISpace>(["space", "space-2"])?.archivedAt).toBeNull();
    expect(queryClient.getQueryState(["spaces", { page: 1 }])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["favorites", "spaces"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["spaceMembers", "space-1", ""])?.isInvalidated).toBe(false);
  });

  it("clears the marker when the space is unarchived", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["space", "eng"], {
      id: "space-1",
      slug: "eng",
      archivedAt: new Date("2026-11-01T10:00:00Z"),
    } as ISpace);

    applySpaceArchiveChange(queryClient, "space-1", null);

    expect(queryClient.getQueryData<ISpace>(["space", "eng"])?.archivedAt).toBeNull();
  });
});
