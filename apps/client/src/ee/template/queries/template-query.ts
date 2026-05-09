import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
  InfiniteData,
} from "@tanstack/react-query";
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  useTemplate,
} from "@/ee/template/services/template-service.ts";
import { ITemplate } from "@/ee/template/types/template.types";
import { IPagination } from "@/lib/types.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useGetTemplatesQuery(params?: { spaceId?: string }) {
  const { spaceId } = params ?? {};
  return useInfiniteQuery({
    queryKey: ["templates", { spaceId }],
    queryFn: ({ pageParam }) =>
      getTemplates({ spaceId, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
  });
}

export function useGetTemplateByIdQuery(
  templateId: string,
): UseQueryResult<ITemplate, Error> {
  return useQuery({
    queryKey: ["template", templateId],
    queryFn: () => getTemplateById(templateId),
    enabled: !!templateId,
  });
}

export function useCreateTemplateMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<ITemplate, Error, Partial<ITemplate>>({
    mutationFn: (data) => createTemplate(data),
    onSuccess: (newTemplate) => {
      queryClient.setQueriesData<InfiniteData<IPagination<ITemplate>>>(
        { queryKey: ["templates"] },
        (old) => {
          if (!old) return old;
          const firstPage = old.pages[0];
          return {
            ...old,
            pages: [
              { ...firstPage, items: [newTemplate, ...firstPage.items] },
              ...old.pages.slice(1),
            ],
          };
        },
      );
      notifications.show({ message: t("Template created successfully") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to create template"),
        color: "red",
      });
    },
  });
}

export function useUpdateTemplateMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    ITemplate,
    Error,
    Partial<ITemplate> & { templateId: string }
  >({
    mutationFn: (data) => updateTemplate(data),
    onSuccess: (updatedTemplate) => {
      queryClient.setQueriesData<InfiniteData<IPagination<ITemplate>>>(
        { queryKey: ["templates"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === updatedTemplate.id ? updatedTemplate : item,
              ),
            })),
          };
        },
      );
      queryClient.setQueryData(
        ["template", updatedTemplate.id],
        updatedTemplate,
      );
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to update template"),
        color: "red",
      });
    },
  });
}

export function useDeleteTemplateMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (templateId) => deleteTemplate(templateId),
    onSuccess: (_data, templateId) => {
      queryClient.setQueriesData<InfiniteData<IPagination<ITemplate>>>(
        { queryKey: ["templates"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== templateId),
            })),
          };
        },
      );
      notifications.show({ message: t("Template deleted") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to delete template"),
        color: "red",
      });
    },
  });
}

export function useUseTemplateMutation() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: {
      templateId: string;
      spaceId: string;
      parentPageId?: string;
    }) => useTemplate(data),
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to create page from template"),
        color: "red",
      });
    },
  });
}
