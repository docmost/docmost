import { useQuery } from "@tanstack/react-query";
import { listConfluenceImports } from "@/ee/confluence-import/services/confluence-import-service";

export const confluenceImportsQueryKey = ["confluence-imports"] as const;

export function useConfluenceImportsQuery() {
  return useQuery({
    queryKey: confluenceImportsQueryKey,
    queryFn: listConfluenceImports,
    refetchInterval: (query) => {
      const hasRunning = query.state.data?.items?.some(
        (i) => i.status === "processing",
      );
      return hasRunning ? 3000 : false;
    },
  });
}
