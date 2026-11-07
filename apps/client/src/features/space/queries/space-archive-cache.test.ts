import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { ISpace } from "@/features/space/types/space.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

const { applySpaceArchiveChange } = await import("./space-query");

describe("applySpaceArchiveChange", () => {
  it("marks every cached copy of the space and drops the inactive space lists", () => {
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
    const archivedBy = { id: "user-1", name: "Ada", avatarUrl: "" };
    applySpaceArchiveChange(queryClient, "space-1", archivedAt, archivedBy);

    expect(queryClient.getQueryData<ISpace>(["space", "space-1"])?.archivedAt).toEqual(archivedAt);
    expect(queryClient.getQueryData<ISpace>(["space", "space-1"])?.archivedBy).toEqual(archivedBy);
    expect(queryClient.getQueryData<ISpace>(["space", "eng"])?.archivedAt).toEqual(archivedAt);
    expect(queryClient.getQueryData<ISpace>(["space", "space-2"])?.archivedAt).toBeNull();
    expect(queryClient.getQueryState(["spaces", { page: 1 }])).toBeUndefined();
    expect(queryClient.getQueryState(["favorites", "spaces"])).toBeUndefined();
    expect(queryClient.getQueryState(["spaceMembers", "space-1", ""])?.isInvalidated).toBe(false);
  });

  it("clears the marker when the space is unarchived", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["space", "eng"], {
      id: "space-1",
      slug: "eng",
      archivedAt: new Date("2026-11-01T10:00:00Z"),
    } as ISpace);

    applySpaceArchiveChange(queryClient, "space-1", null, null);

    expect(queryClient.getQueryData<ISpace>(["space", "eng"])?.archivedAt).toBeNull();
  });

  it("does not rewrite cached spaces that did not change", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ["space", "space-2"],
      { id: "space-2", slug: "ops", archivedAt: null } as ISpace,
      { updatedAt: 1000 },
    );

    applySpaceArchiveChange(queryClient, "space-1", new Date(), null);

    expect(queryClient.getQueryState(["space", "space-2"])?.dataUpdatedAt).toBe(1000);
  });

  it("drops inactive copies of the other server-filtered lists", () => {
    const queryClient = new QueryClient();
    const prefixes = [
      "published-spaces",
      "templates",
      "verification-list",
      "label-pages",
      "workspace-labels",
      "search-suggestion",
    ];
    for (const prefix of prefixes) {
      queryClient.setQueryData([prefix, "x"], []);
    }

    applySpaceArchiveChange(queryClient, "space-1", new Date(), null);

    for (const prefix of prefixes) {
      expect(queryClient.getQueryState([prefix, "x"])).toBeUndefined();
    }
  });

  it("removes inactive matches and invalidates active ones", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["spaces", "inactive"], []);
    queryClient.setQueryData(["spaces", "active"], []);
    const observer = new QueryObserver(queryClient, {
      queryKey: ["spaces", "active"],
      queryFn: () => [],
    });
    const unsubscribe = observer.subscribe(() => {});

    applySpaceArchiveChange(queryClient, "space-1", new Date(), null);

    expect(queryClient.getQueryState(["spaces", "inactive"])).toBeUndefined();
    expect(queryClient.getQueryState(["spaces", "active"])?.isInvalidated).toBe(true);
    unsubscribe();
  });
});
