import { useMutation } from "@tanstack/react-query";
import {
  createView,
  updateView,
  deleteView,
} from "@/features/base/services/base-service";
import {
  IBase,
  IBaseView,
  CreateViewInput,
  UpdateViewInput,
  DeleteViewInput,
} from "@/features/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";

export function useCreateViewMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseView, Error, CreateViewInput>({
    mutationFn: (data) => createView(data),
    onSuccess: (newView) => {
      queryClient.setQueryData<IBase>(
        ["bases", newView.baseId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            views: [...old.views, newView],
          };
        },
      );
    },
    onError: () => {
      notifications.show({
        message: t("Failed to create view"),
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
        queryKey: ["bases", variables.baseId],
      });

      const previous = queryClient.getQueryData<IBase>([
        "bases",
        variables.baseId,
      ]);

      queryClient.setQueryData<IBase>(
        ["bases", variables.baseId],
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
                      config: variables.config,
                    }),
                  }
                : v,
            ),
          };
        },
      );

      return { previous };
    },
    onError: (_, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["bases", variables.baseId],
          context.previous,
        );
      }
      notifications.show({
        message: t("Failed to update view"),
        color: "red",
      });
    },
    onSuccess: (updatedView) => {
      queryClient.setQueryData<IBase>(
        ["bases", updatedView.baseId],
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
        ["bases", variables.baseId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            views: old.views.filter((v) => v.id !== variables.viewId),
          };
        },
      );
    },
    onError: () => {
      notifications.show({
        message: t("Failed to delete view"),
        color: "red",
      });
    },
  });
}
