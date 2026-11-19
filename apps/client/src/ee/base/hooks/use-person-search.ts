import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { searchSuggestions } from "@/features/search/services/search-service";

export type PersonSuggestion = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export function usePersonSearch(
  search: string,
  enabled: boolean,
  options?: { includeDeactivatedUsers?: boolean },
): PersonSuggestion[] {
  const [debounced] = useDebouncedValue(search, 250);
  const trimmed = debounced.trim();
  const includeDeactivatedUsers = options?.includeDeactivatedUsers ?? false;
  const { data = [] } = useQuery({
    queryKey: [
      "bases",
      "persons",
      "search",
      trimmed,
      { includeDeactivatedUsers },
    ],
    queryFn: async () => {
      const res = await searchSuggestions({
        query: trimmed,
        includeUsers: true,
        includeDeactivatedUsers,
        limit: trimmed ? 25 : 10,
      });
      return (res.users ?? []) as PersonSuggestion[];
    },
    enabled,
    staleTime: 15_000,
  });
  return data;
}
