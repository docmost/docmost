import { useQuery } from "@tanstack/react-query";
import { listChangeRequests } from "../api/change-requests.api";
import type { ChangeRequest } from "../types/service.types";

export function useServiceLock(serviceId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ["service-lock", serviceId],
    queryFn: () =>
      listChangeRequests({ serviceId, status: "IN_IMPLEMENTATION", limit: 1 }),
    enabled: !!serviceId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const activeCr: ChangeRequest | undefined = data?.items[0];

  return {
    isLocked: !!activeCr,
    activeCr,
    isLoading,
  };
}
