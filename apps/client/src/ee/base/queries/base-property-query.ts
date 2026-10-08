import { InfiniteData, useMutation } from "@tanstack/react-query";
import {
  createProperty,
  updateProperty,
  deleteProperty,
  reorderProperty,
} from "@/ee/base/services/base-service";
import {
  IBase,
  IBaseProperty,
  IBaseRow,
  CreatePropertyInput,
  UpdatePropertyInput,
  DeletePropertyInput,
  ReorderPropertyInput,
  UpdatePropertyResult,
} from "@/ee/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { IPagination } from "@/lib/types";

export function useCreatePropertyMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseProperty, Error, CreatePropertyInput>({
    mutationFn: (data) => createProperty(data),
    onSuccess: (newProperty) => {
      queryClient.setQueryData<IBase>(
        ["bases", newProperty.pageId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            properties: [...old.properties, newProperty],
          };
        },
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create property")),
        color: "red",
      });
    },
  });
}

export function useUpdatePropertyMutation() {
  const { t } = useTranslation();
  return useMutation<UpdatePropertyResult, Error, UpdatePropertyInput>({
    mutationFn: (data) => updateProperty(data),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<IBase>(
        ["bases", variables.pageId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            properties: old.properties.map((p) =>
              p.id === result.property.id ? result.property : p,
            ),
          };
        },
      );

      if (variables.type && !result.jobId) {
        queryClient.invalidateQueries({
          queryKey: ["base-rows", variables.pageId],
        });
      }
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update property")),
        color: "red",
      });
    },
  });
}

export function useDeletePropertyMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, DeletePropertyInput>({
    mutationFn: (data) => deleteProperty(data),
    onSuccess: (_, variables) => {
      queryClient.setQueryData<IBase>(
        ["bases", variables.pageId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            properties: old.properties.filter(
              (p) => p.id !== variables.propertyId,
            ),
          };
        },
      );

      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", variables.pageId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((row) => {
                if (!(variables.propertyId in row.cells)) return row;
                const { [variables.propertyId]: _, ...rest } = row.cells;
                return { ...row, cells: rest };
              }),
            })),
          };
        },
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete property")),
        color: "red",
      });
    },
  });
}

export function useReorderPropertyMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, ReorderPropertyInput, { previous: IBase | undefined }>({
    mutationFn: (data) => reorderProperty(data),
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
            properties: old.properties.map((p) =>
              p.id === variables.propertyId
                ? { ...p, position: variables.position }
                : p,
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
        message: getApiErrorMessage(error, t("Failed to reorder property")),
        color: "red",
      });
    },
  });
}
