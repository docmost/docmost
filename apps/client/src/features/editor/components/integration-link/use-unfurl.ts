import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { unfurlUrl } from "@/features/integration/services/integration-service";
import {
  UnfurlNeedsConnection,
  UnfurlResult,
} from "@/features/integration/types/integration.types";

const UNFURL_STALE_TIME = 5 * 60 * 1000; // mirrors the server-side Redis TTL

export type UnfurlState =
  | { state: "anonymous" }
  | { state: "loading" }
  | { state: "error" }
  | { state: "needsConnection"; needsConnection: UnfurlNeedsConnection }
  | { state: "loaded"; data: UnfurlResult };

// Resolves the unfurl per viewer at render time. Nothing is written back into
// the document, so third-party permissions are enforced on every view:
// unconnected viewers get needsConnection and anonymous viewers never fetch.
export function useUnfurl(url: string): UnfurlState {
  const currentUser = useAtomValue(currentUserAtom);
  const isAuthenticated = Boolean(currentUser?.user);

  const query = useQuery({
    queryKey: ["unfurl", url],
    queryFn: () => unfurlUrl({ url }),
    enabled: isAuthenticated && Boolean(url),
    staleTime: UNFURL_STALE_TIME,
    retry: false,
  });

  if (!isAuthenticated || !url) {
    return { state: "anonymous" };
  }
  if (query.isPending) {
    return { state: "loading" };
  }
  if (query.isError || !query.data) {
    return { state: "error" };
  }
  if ("needsConnection" in query.data) {
    return { state: "needsConnection", needsConnection: query.data };
  }
  return { state: "loaded", data: query.data };
}
