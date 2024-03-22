import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { ISpace } from "@/features/space/types/space.types";
import { getUserSpaces } from "@/features/space/services/space-service";

export function useUserSpacesQuery(): UseQueryResult<ISpace[], Error> {
  return useQuery({
    queryKey: ["user-spaces"],
    queryFn: () => getUserSpaces(),
  });
}
