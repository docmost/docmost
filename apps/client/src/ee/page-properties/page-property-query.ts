import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import api from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import type { PageProperty, PagePropertyChange } from "./page-property.types";

function byPosition(a: PageProperty, b: PageProperty) {
  if (a.position === b.position) return a.id.localeCompare(b.id, "en");
  return a.position < b.position ? -1 : 1;
}

function applyChange(properties: PageProperty[], change: PagePropertyChange) {
  if (change.action === "values/update") {
    return properties.map((p) =>
      p.id in change.values ? { ...p, value: change.values[p.id] } : p,
    );
  }
  if (change.action === "reorder") {
    return properties
      .map((p) =>
        p.id === change.propertyId ? { ...p, position: change.position } : p,
      )
      .sort(byPosition);
  }
  return properties;
}

export async function getPageProperties(
  pageId: string,
  propertyIds?: string[],
  signal?: AbortSignal,
) {
  const response = await api.post<PageProperty[]>(
    "/pages/properties",
    { pageId, propertyIds },
    { signal },
  );
  return response.data;
}

export function usePageProperties(pageId: string, userId: string) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const queryKey = ["page-properties", userId, pageId];
  const mutationKey = ["change-page-properties", userId, pageId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPageProperties(pageId, undefined, signal),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const mutation = useMutation({
    mutationKey,
    scope: { id: mutationKey.join("/") },
    mutationFn: async ({ action, ...body }: PagePropertyChange) => {
      const response = await api.post<PageProperty | PageProperty[]>(
        `/pages/properties/${action}`,
        { pageId, ...body },
      );
      return response?.data;
    },
    onSuccess: async (result, change) => {
      await client.cancelQueries({ queryKey });
      client.setQueryData<PageProperty[]>(queryKey, (properties) => {
        if (!properties) return properties;
        if (change.action === "delete")
          return properties.filter((p) => p.id !== change.propertyId);
        if (change.action === "reorder") return applyChange(properties, change);
        const merged = new Map(properties.map((p) => [p.id, p]));
        for (const updated of Array.isArray(result) ? result : [result])
          merged.set(updated.id, updated);
        return [...merged.values()].sort(byPosition);
      });
      void client.invalidateQueries({ queryKey: ["page-property-report"] });
      if (change.action === "reorder")
        await client.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update property")),
        color: "red",
      });
      void client.invalidateQueries({ queryKey });
    },
  });
  const pending = useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (item) => item.state.variables as PagePropertyChange,
  });

  // Keep rapid picks and moves visible in submission order until the server read settles.
  const properties = pending.reduce(applyChange, query.data ?? []);
  return { query, properties, mutation };
}
