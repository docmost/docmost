import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  IntegrationResolvedResource,
  IntegrationResourceSearchResult,
  resolveIntegrationResource,
  searchIntegrationResource,
} from "@/features/integrations/services/integration-resource-service";

function noRetryOnClientError(failureCount: number, error: Error): boolean {
  const status = (error as Error & { response?: { status?: number } })?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export function useSearchIntegrationResourceQuery(args: {
  integrationId: string;
  resourceId: string;
  q?: string;
  enabled?: boolean;
  searchOnEmpty?: boolean;
}): UseQueryResult<IntegrationResourceSearchResult[], Error> {
  const q = args.q ?? "";
  return useQuery({
    queryKey: ["integration-resource", "search", args.integrationId, args.resourceId, q],
    queryFn: () =>
      searchIntegrationResource({
        integrationId: args.integrationId,
        resourceId: args.resourceId,
        q,
        limit: 10,
      }),
    enabled:
      args.enabled !== false &&
      !!args.integrationId &&
      !!args.resourceId &&
      (args.searchOnEmpty === true || q.trim().length > 1),
    staleTime: 30_000,
    retry: noRetryOnClientError,
  });
}

export function useResolveIntegrationResourceQuery(args: {
  integrationId: string;
  resourceId: string;
  resourceKey: string;
  params?: Record<string, unknown> | null;
  enabled?: boolean;
}): UseQueryResult<IntegrationResolvedResource, Error> {
  return useQuery({
    queryKey: [
      "integration-resource",
      "resolve",
      args.integrationId,
      args.resourceId,
      args.resourceKey,
      args.params,
    ],
    queryFn: () =>
      resolveIntegrationResource({
        integrationId: args.integrationId,
        resourceId: args.resourceId,
        resourceKey: args.resourceKey,
        params: args.params,
      }),
    enabled:
      args.enabled !== false && !!args.integrationId && !!args.resourceId && !!args.resourceKey,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    retry: noRetryOnClientError,
  });
}
