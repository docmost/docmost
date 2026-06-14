import { useMutation } from "@tanstack/react-query";
import {
  createView,
  updateView,
  deleteView,
} from "@/ee/base/services/base-service";
import {
  IBase,
  IBaseView,
  CreateViewInput,
  UpdateViewInput,
  DeleteViewInput,
  ViewConfig,
  ViewConfigPatch,
} from "@/ee/base/types/base.types";

function applyConfigPatch(
  existing: ViewConfig | undefined,
  patch: ViewConfigPatch | undefined,
): ViewConfig {
  const merged: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null) delete merged[key];
    else if (value !== undefined) merged[key] = value;
  }
  return merged as ViewConfig;
}
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";

export function useCreateViewMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseView, Error, CreateViewInput>({
    mutationFn: (data) => createView(data),
    onSuccess: (newView) => {
      queryClient.setQueryData<IBase>(
        ["bases", newView.pageId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            views: [...old.views, newView],
          };
        },
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create view")),
        color: "red",
      });
    },
  });
}

export function useUpdateViewMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseView, Error, UpdateViewInput, { previous: IBase | undefined }>({
    mutationFn: (data) => updateView(data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["bases", variables.pageId],
      });

      const previous = queryClient.getQueryData<IBase>([
        "bases",
        variables.pageId,
      ]);

      queryClient.setQueryData<IBase>(
        ["bases", variables.pageId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            views: old.views.map((v) =>
              v.id === variables.viewId
                ? {
                    ...v,
                    ...(variables.name !== undefined && {
                      name: variables.name,
                    }),
                    ...(variables.type !== undefined && {
                      type: variables.type,
                    }),
                    ...(variables.config !== undefined && {
                      config: applyConfigPatch(v.config, variables.config),
                    }),
                    ...(variables.position !== undefined && {
                      position: variables.position,
                    }),
                  }
                : v,
            ),
          };
        },
      );

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["bases", variables.pageId],
          context.previous,
        );
      }
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update view")),
        color: "red",
      });
    },
    onSuccess: (updatedView) => {
      queryClient.setQueryData<IBase>(
        ["bases", updatedView.pageId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            views: old.views.map((v) =>
              v.id === updatedView.id ? updatedView : v,
            ),
          };
        },
      );
    },
  });
}

export function useDeleteViewMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, DeleteViewInput>({
    mutationFn: (data) => deleteView(data),
    onSuccess: (_, variables) => {
      queryClient.setQueryData<IBase>(
        ["bases", variables.pageId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            views: old.views.filter((v) => v.id !== variables.viewId),
          };
        },
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete view")),
        color: "red",
      });
    },
  });
}
