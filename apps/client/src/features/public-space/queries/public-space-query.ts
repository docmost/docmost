import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  getPublicSpaceDirectory,
  getPublicSpaceForSpace,
  getPublicSpacePage,
  getPublicSpaceTree,
  getPublishedSpaces,
  publishSpace,
} from "@/features/public-space/services/public-space-service.ts";
import {
  IPublicSpace,
  IPublicSpaceDirectory,
  IPublicSpacePage,
  IPublicSpaceTree,
  IPublishedSpaceItem,
  IPublishSpace,
} from "@/features/public-space/types/public-space.types.ts";
import { IPagination, QueryParams } from "@/lib/types.ts";

export function usePublicSpaceTreeQuery(
  spaceSlug: string,
): UseQueryResult<IPublicSpaceTree, Error> {
  return useQuery({
    queryKey: ["public-space-tree", spaceSlug],
    queryFn: () => getPublicSpaceTree(spaceSlug),
    enabled: !!spaceSlug,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
  });
}

export function usePublicSpacePageQuery(params: {
  spaceSlug: string;
  pageSlugId?: string;
  contentless?: boolean;
}): UseQueryResult<IPublicSpacePage, Error> {
  return useQuery({
    queryKey: ["public-space-page", params],
    queryFn: () => getPublicSpacePage(params),
    enabled: !!params.spaceSlug,
  });
}

export function usePublicSpaceDirectoryQuery(): UseQueryResult<
  IPublicSpaceDirectory,
  Error
> {
  return useQuery({
    queryKey: ["public-space-directory"],
    queryFn: () => getPublicSpaceDirectory(),
  });
}

export function usePublicSpaceForSpaceQuery(
  spaceId: string,
): UseQueryResult<IPublicSpace | null, Error> {
  return useQuery({
    queryKey: ["public-space-for-space", spaceId],
    queryFn: () => getPublicSpaceForSpace(spaceId),
    enabled: !!spaceId,
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function usePublishedSpacesQuery(
  params?: QueryParams,
): UseQueryResult<IPagination<IPublishedSpaceItem>, Error> {
  return useQuery({
    queryKey: ["published-spaces", params],
    queryFn: () => getPublishedSpaces(params),
    placeholderData: keepPreviousData,
  });
}

export function usePublishSpaceMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation<IPublicSpace, Error, IPublishSpace>({
    mutationFn: (data) => publishSpace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (item) =>
          [
            "public-space-for-space",
            "published-spaces",
            "space",
            "spaces",
          ].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      notifications.show({
        message:
          error?.["response"]?.data?.message || t("Failed to update space"),
        color: "red",
      });
    },
  });
}
