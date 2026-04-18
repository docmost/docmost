import { InfiniteData, useMutation } from "@tanstack/react-query";
import {
  createProperty,
  updateProperty,
  deleteProperty,
  reorderProperty,
} from "@/features/base/services/base-service";
import {
  IBase,
  IBaseProperty,
  IBaseRow,
  CreatePropertyInput,
  UpdatePropertyInput,
  DeletePropertyInput,
  ReorderPropertyInput,
  UpdatePropertyResult,
} from "@/features/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { IPagination } from "@/lib/types";

export function useCreatePropertyMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseProperty, Error, CreatePropertyInput>({
    mutationFn: (data) => createProperty(data),
    onSuccess: (newProperty) => {
      queryClient.setQueryData<IBase>(
        ["bases", newProperty.baseId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            properties: [...old.properties, newProperty],
          };
        },
      );
    },
    onError: () => {
      notifications.show({
        message: t("Failed to create property"),
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
        ["bases", variables.baseId],
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

      // Invalidate rows only for the synchronous (inline) path — the
      // HTTP response there is the "cells are migrated" signal. When the
      // server hands back a `jobId`, cells are still being rewritten; the
      // `base:schema:bumped` socket event is the canonical refetch
      // trigger in that case, and we'd only churn pages with old data by
      // refetching now.
      if (variables.type && !result.jobId) {
        queryClient.invalidateQueries({
          queryKey: ["base-rows", variables.baseId],
        });
      }
    },
    onError: () => {
      notifications.show({
        message: t("Failed to update property"),
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
        ["bases", variables.baseId],
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
        { queryKey: ["base-rows", variables.baseId] },
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
    onError: () => {
      notifications.show({
        message: t("Failed to delete property"),
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
    onError: (_, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["bases", variables.baseId],
          context.previous,
        );
      }
      notifications.show({
        message: t("Failed to reorder property"),
        color: "red",
      });
    },
  });
}
