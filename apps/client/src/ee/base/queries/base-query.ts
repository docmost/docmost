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
  convertPageToBase,
} from "@/ee/base/services/base-service";
import {
  IBase,
  CreateBaseInput,
  UpdateBaseInput,
} from "@/ee/base/types/base.types";
import { IPage } from "@/features/page/types/page.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { SpaceTreeNode } from "@/features/page/tree/types";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";

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
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create base")),
        color: "red",
      });
    },
  });
}

export function useConvertPageToBaseMutation() {
  const { t } = useTranslation();
  const [, setTreeData] = useAtom(treeDataAtom);
  const [socket] = useAtom(socketAtom);

  return useMutation<IBase, Error, { pageId: string; template?: "kanban" }>({
    mutationFn: ({ pageId, template }) => convertPageToBase(pageId, template),
    onSuccess: (base) => {
      const markAsBase = (old?: IPage) => (old ? { ...old, isBase: true } : old);
      queryClient.setQueryData<IPage>(["pages", base.id], markAsBase);
      queryClient.setQueryData<IPage>(["pages", base.slugId], markAsBase);

      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({
        queryKey: ["root-sidebar-pages", base.spaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["sidebar-pages"] });
      setTreeData((prev) =>
        treeModel.update(prev, base.id, { isBase: true } as Partial<SpaceTreeNode>),
      );
      socket?.emit("message", {
        operation: "updateOne",
        spaceId: base.spaceId,
        entity: ["pages"],
        id: base.id,
        payload: { isBase: true, slugId: base.slugId },
      });
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create base")),
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
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update base")),
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
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete base")),
        color: "red",
      });
    },
  });
}
