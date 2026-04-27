import {
  useMutation,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  createBase,
  getBaseInfo,
  updateBase,
  deleteBase,
} from "@/features/base/services/base-service";
import {
  IBase,
  CreateBaseInput,
  UpdateBaseInput,
} from "@/features/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";

export function useBaseQuery(
  pageId: string | undefined,
): UseQueryResult<IBase, Error> {
  return useQuery({
    queryKey: ["bases", pageId],
    queryFn: () => getBaseInfo(pageId!),
    enabled: !!pageId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBaseMutation() {
  const { t } = useTranslation();
  return useMutation<IBase, Error, CreateBaseInput>({
    mutationFn: (data) => createBase(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["bases", "list", data.spaceId],
      });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to create base"),
        color: "red",
      });
    },
  });
}

export function useUpdateBaseMutation() {
  const { t } = useTranslation();
  return useMutation<IBase, Error, UpdateBaseInput>({
    mutationFn: (data) => updateBase(data),
    onSuccess: (data) => {
      queryClient.setQueryData<IBase>(["bases", data.id], (old) => {
        if (!old) return old;
        return { ...old, ...data };
      });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to update base"),
        color: "red",
      });
    },
  });
}

export function useDeleteBaseMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, { pageId: string; spaceId: string }>({
    mutationFn: ({ pageId }) => deleteBase(pageId),
    onSuccess: (_, { pageId, spaceId }) => {
      queryClient.removeQueries({ queryKey: ["bases", pageId] });
      queryClient.invalidateQueries({
        queryKey: ["bases", "list", spaceId],
      });
      notifications.show({ message: t("Base deleted") });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to delete base"),
        color: "red",
      });
    },
  });
}
