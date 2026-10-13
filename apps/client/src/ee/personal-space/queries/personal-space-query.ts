import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { ISpace } from "@/features/space/types/space.types";
import {
  createPersonalSpace,
  getPersonalSpace,
} from "@/ee/personal-space/services/personal-space-service";

export function usePersonalSpaceQuery(
  enabled: boolean,
): UseQueryResult<ISpace | null, Error> {
  return useQuery({
    queryKey: ["personal-space"],
    queryFn: () => getPersonalSpace(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePersonalSpaceMutation() {
  const queryClient = useQueryClient();

  return useMutation<ISpace, Error, { name?: string }>({
    mutationFn: (data) => createPersonalSpace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-space"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });
}
