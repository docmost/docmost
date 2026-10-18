import type { QueryClient } from "@tanstack/react-query";
import { isReaderOfControlledPage } from "@/features/page/page.utils";
import type { IPage } from "@/features/page/types/page.types";

type PageKeys = {
  pageId: string;
  slugId: string;
};

// Hocuspocus refuses a connection with this close event (code 4403).
export function isForbiddenClose(event?: {
  code?: number;
  reason?: string;
}): boolean {
  return event?.reason === "Forbidden" || event?.code === 4403;
}

const rechecks = new Map<string, Promise<void>>();

// Approval can be switched on under an open reader, so ask the server: approved view or lost access.
function recheckPageAccess(
  queryClient: QueryClient,
  { pageId, slugId }: PageKeys,
): Promise<void> {
  const running = rechecks.get(pageId);
  if (running) return running;

  const recheck = (async () => {
    await queryClient.refetchQueries({
      queryKey: ["pages", slugId],
      exact: true,
    });
    queryClient.invalidateQueries({ queryKey: ["pages", pageId], exact: true });

    const query = queryClient
      .getQueryCache()
      .find<IPage>({ queryKey: ["pages", slugId], exact: true });
    // The server still serves the page, so its answer is stale; collab already refused.
    if (
      query?.state.status === "success" &&
      !isReaderOfControlledPage(query.state.data)
    ) {
      query.setState({
        status: "error",
        fetchStatus: "idle",
        data: undefined,
        error: Object.assign(new Error("Forbidden"), { status: 403 }),
      });
    }
  })().finally(() => rechecks.delete(pageId));

  rechecks.set(pageId, recheck);
  return recheck;
}

/**
 * Collab reported the user's access (a `page.permissions` message, or a
 * connection closed as forbidden). Resolves once a refused user's page is settled.
 */
export function applyCollabAccess(
  queryClient: QueryClient,
  keys: PageKeys,
  access: string,
): Promise<void> {
  // applied locally, a refetch can still read the old access from the server cache
  for (const key of [keys.slugId, keys.pageId]) {
    queryClient.setQueryData<IPage>(
      ["pages", key],
      (page) =>
        page && {
          ...page,
          permissions: { ...page.permissions, canEdit: false },
        },
    );
  }

  return access === "none"
    ? recheckPageAccess(queryClient, keys)
    : Promise.resolve();
}
