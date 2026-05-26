import { useQuery } from "@tanstack/react-query";
import { getAvailableTransitions } from "../api/change-requests.api";
import type { AvailableTransition } from "../types/cr.types";

export function useAvailableTransitions(crId: string | undefined) {
  return useQuery<{ actions: AvailableTransition[] }>({
    queryKey: ["cr-transitions", crId],
    queryFn: () => getAvailableTransitions(crId!),
    enabled: !!crId,
    staleTime: 10_000,
  });
}
