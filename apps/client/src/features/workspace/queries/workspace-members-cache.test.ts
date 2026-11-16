import { describe, expect, it } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { refreshWorkspaceMembers } from "./workspace-query";

const membersKey = (status: string) => [
  "workspaceMembers",
  { limit: 100, query: "", status },
];

describe("refreshWorkspaceMembers", () => {
  it("drops the member lists that are not on screen and invalidates the one that is", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(membersKey("active"), { items: [] });
    queryClient.setQueryData(membersKey("all"), { items: [] });
    queryClient.setQueryData(membersKey("deactivated"), { items: [] });
    const observer = new QueryObserver(queryClient, {
      queryKey: membersKey("deactivated"),
      queryFn: () => ({ items: [] }),
    });
    const unsubscribe = observer.subscribe(() => {});

    refreshWorkspaceMembers(queryClient);

    expect(queryClient.getQueryState(membersKey("active"))).toBeUndefined();
    expect(queryClient.getQueryState(membersKey("all"))).toBeUndefined();
    expect(
      queryClient.getQueryState(membersKey("deactivated"))?.isInvalidated,
    ).toBe(true);
    unsubscribe();
  });

  it("leaves other cached lists alone", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["invitations", {}], { items: [] });

    refreshWorkspaceMembers(queryClient);

    expect(queryClient.getQueryState(["invitations", {}])?.isInvalidated).toBe(
      false,
    );
  });
});
