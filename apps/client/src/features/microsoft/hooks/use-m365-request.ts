import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { M365ErrorCode, M365NeedsConnection } from "../types/microsoft.types";

export type M365RequestState<T> =
  | { state: "anonymous" }
  | { state: "loading" }
  | { state: "needsConnection"; needsConnection: M365NeedsConnection }
  | { state: "forbidden" }
  | { state: "notFound" }
  | { state: "error"; code: M365ErrorCode | null }
  | { state: "loaded"; data: T };

export function m365ErrorCode(error: unknown): M365ErrorCode | null {
  const data = (error as any)?.response?.data;
  return typeof data?.code === "string" ? (data.code as M365ErrorCode) : null;
}

export function useM365Request<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
  options?: { enabled?: boolean; staleTime?: number; gcTime?: number },
): M365RequestState<T> & { refetch: () => void } {
  const currentUser = useAtomValue(currentUserAtom);
  const isAuthenticated = Boolean(currentUser?.user);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: isAuthenticated && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 60_000,
    gcTime: options?.gcTime,
    retry: (failureCount, error) => m365ErrorCode(error) === "rate_limited" && failureCount < 2,
    retryDelay: (_attempt, error) =>
      Math.min(((error as any)?.response?.data?.retryAfterSeconds ?? 5) * 1000, 60_000),
  });

  const refetch = () => {
    void query.refetch();
  };

  if (!isAuthenticated) return { state: "anonymous", refetch };
  if (options?.enabled === false) return { state: "loading", refetch };
  if (query.isPending) return { state: "loading", refetch };
  if (query.isError) {
    const code = m365ErrorCode(query.error);
    if (code === "needs_connection") {
      return {
        state: "needsConnection",
        needsConnection: (query.error as any).response.data as M365NeedsConnection,
        refetch,
      };
    }
    if (code === "forbidden") return { state: "forbidden", refetch };
    if (code === "not_found") return { state: "notFound", refetch };
    return { state: "error", code, refetch };
  }
  return { state: "loaded", data: query.data as T, refetch };
}
