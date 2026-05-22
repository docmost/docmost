import { useMutation, useQuery } from "@tanstack/react-query";
import {
  listReferences,
  unsyncReference,
} from "../services/transclusion-api";

export function useReferencesQuery(
  sourcePageId: string | null,
  transclusionId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["transclusion-references", sourcePageId, transclusionId],
    queryFn: () =>
      listReferences({
        sourcePageId: sourcePageId!,
        transclusionId: transclusionId!,
      }),
    enabled: enabled && !!sourcePageId && !!transclusionId,
    staleTime: 10 * 1000,
  });
}

export function useUnsyncReferenceMutation() {
  return useMutation({
    mutationFn: (params: {
      referencePageId: string;
      sourcePageId: string;
      transclusionId: string;
    }) => unsyncReference(params),
  });
}
