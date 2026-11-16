import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  activateWorkspaceMember,
  deactivateWorkspaceMember,
  deleteWorkspaceMember,
} from "@/features/workspace/services/workspace-service";
import {
  useActivateWorkspaceMemberMutation,
  useDeactivateWorkspaceMemberMutation,
  useDeleteWorkspaceMemberMutation,
} from "./workspace-query";

vi.mock("@/features/workspace/services/workspace-service", () => ({
  activateWorkspaceMember: vi.fn(),
  deactivateWorkspaceMember: vi.fn(),
  deleteWorkspaceMember: vi.fn(),
}));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value: string) => value }),
}));

const clients: QueryClient[] = [];

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.clearAllMocks();
});

describe.each([
  ["activation", useActivateWorkspaceMemberMutation, activateWorkspaceMember],
  [
    "deactivation",
    useDeactivateWorkspaceMemberMutation,
    deactivateWorkspaceMember,
  ],
  ["deletion", useDeleteWorkspaceMemberMutation, deleteWorkspaceMember],
] as const)("workspace member %s", (_, useMemberMutation, request) => {
  it("refreshes mounted lists and reloads cached lists when reopened", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          staleTime: 5 * 60 * 1000,
        },
      },
    });
    clients.push(client);
    vi.mocked(request).mockResolvedValue(undefined);

    const inactiveKeys = [
      ["workspaceMembers", { status: "active" }],
      ["groups", {}],
      ["group", "group-1"],
      ["groupMembers", "group-2", {}],
      ["spaceMembers", "space-1", ""],
      ["page-permissions", "page-1"],
      ["search-suggestion", { query: "Ada", includeUsers: true }],
      [
        "search-suggestion",
        { query: "Ada", includeUsers: true, includeDeactivatedUsers: true },
      ],
      ["bases", "persons", "search", "Ada", { includeDeactivatedUsers: false }],
      ["bases", "persons", "search", "Ada", { includeDeactivatedUsers: true }],
    ];
    const before = { state: "before change" };
    const after = { state: "after change" };
    for (const key of inactiveKeys) client.setQueryData(key, before);
    const unrelatedKeys = [
      ["bases", "page-1"],
      ["base-rows", "page-1"],
    ];
    for (const key of unrelatedKeys) client.setQueryData(key, before);

    const activeKey = ["groupMembers", "group-1", {}];
    client.setQueryData(activeKey, before);
    const fetchMembers = vi.fn().mockResolvedValue(after);
    const observer = new QueryObserver(client, {
      queryKey: activeKey,
      queryFn: fetchMembers,
    });
    const unsubscribe = observer.subscribe(() => {});
    expect(fetchMembers).not.toHaveBeenCalled();

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useMemberMutation, { wrapper });

    try {
      await act(async () => {
        await result.current.mutateAsync({ userId: "user-1" });
      });

      expect(request).toHaveBeenCalledWith({ userId: "user-1" });
      await waitFor(() =>
        expect(observer.getCurrentResult().data).toEqual(after),
      );
      expect(fetchMembers).toHaveBeenCalledTimes(1);
      for (const key of inactiveKeys) {
        expect(client.getQueryState(key)).toBeUndefined();
      }
      for (const key of unrelatedKeys) {
        expect(client.getQueryData(key)).toEqual(before);
      }

      const fetchGroups = vi.fn().mockResolvedValue(after);
      const reopened = new QueryObserver(client, {
        queryKey: ["groups", {}],
        queryFn: fetchGroups,
      });
      const unsubscribeReopened = reopened.subscribe(() => {});
      try {
        await waitFor(() =>
          expect(reopened.getCurrentResult().data).toEqual(after),
        );
        expect(fetchGroups).toHaveBeenCalledTimes(1);
      } finally {
        unsubscribeReopened();
      }
    } finally {
      unsubscribe();
    }
  });
});
