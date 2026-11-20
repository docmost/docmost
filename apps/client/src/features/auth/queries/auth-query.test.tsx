import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useCollabToken } from "./auth-query";

const { getCollabToken } = vi.hoisted(() => ({ getCollabToken: vi.fn() }));
vi.mock("../services/auth-service", () => ({ getCollabToken }));
afterEach(cleanup);

const token = (sub: string, workspaceId: string) =>
  `header.${btoa(JSON.stringify({ sub, workspaceId }))}.signature`;

it("keeps tokens in the issuing user's workspace and refuses a stale session response", async () => {
  const client = new QueryClient();
  const a = { id: "user-a", workspaceId: "workspace" };
  const b = { id: "user-b", workspaceId: "workspace" };
  const first = { token: token(a.id, a.workspaceId) };
  getCollabToken.mockResolvedValue(first);
  const { result, rerender } = renderHook(({ user }) => useCollabToken(user), {
    initialProps: { user: a },
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await waitFor(() => expect(result.current.data).toEqual(first));
  rerender({ user: b });
  expect(result.current.data).toBeUndefined();
  await waitFor(() =>
    expect(result.current.failureReason?.message).toBe(
      "Collaboration session changed",
    ),
  );
  expect(
    client.getQueryData(["collab-token", b.workspaceId, b.id]),
  ).toBeUndefined();
  expect(client.getQueryData(["collab-token", a.workspaceId, a.id])).toEqual(
    first,
  );
});
