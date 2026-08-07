import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
  InfiniteData,
  keepPreviousData,
} from "@tanstack/react-query";
import { useAtom, useStore } from "jotai";
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
import { invalidateOnCreatePage } from "@/features/page/queries/page-query.ts";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";

export function useGetTemplatesQuery(params?: { spaceId?: string }) {
  const { spaceId } = params ?? {};
  return useInfiniteQuery({
    queryKey: ["templates", { spaceId }],
    queryFn: ({ pageParam }) =>
      getTemplates({ spaceId, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    placeholderData: keepPreviousData,
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
        message: errorMessage ? t(errorMessage) : t("Failed to create template"),
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
        message: errorMessage ? t(errorMessage) : t("Failed to update template"),
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
  const [, setTreeData] = useAtom(treeDataAtom);
  const store = useStore();
  const emit = useQueryEmit();

  return useMutation<
    IPage,
    Error,
    { templateId: string; spaceId: string; parentPageId?: string }
  >({
    mutationFn: (data) => useTemplate(data),
    onSuccess: (page) => {
      // React Query sidebar-pages cache update (same path useCreatePageMutation takes).
      invalidateOnCreatePage(page);

      const parentId = page.parentPageId ?? null;
      const newNode: SpaceTreeNode = {
        id: page.id,
        slugId: page.slugId,
        name: page.title,
        icon: page.icon,
        position: page.position,
        spaceId: page.spaceId,
        parentPageId: page.parentPageId,
        hasChildren: false,
        children: [],
      };

      // Only mutate the tree atom and broadcast if it currently represents
      // this space. Cross-space template-use (e.g., from the gallery picking
      // a different space) lets the target space's clients pick up the new
      // page on their next React Query refetch (focus, navigation, etc.).
      // Without this guard we'd both pollute the local tree and send a wrong
      // `index` to remote clients in the target space.
      const current = store.get(treeDataAtom);
      const treeIsForThisSpace = current[0]?.spaceId === page.spaceId;
      if (!treeIsForThisSpace) return;

      const lastIndex =
        parentId === null
          ? current.length
          : (treeModel.find(current, parentId)?.children?.length ?? 0);

      setTreeData((prev) =>
        treeModel.insert(prev, parentId, newNode, lastIndex),
      );

      setTimeout(() => {
        emit({
          operation: "addTreeNode",
          spaceId: page.spaceId,
          payload: {
            parentId,
            index: lastIndex,
            data: newNode,
          },
        });
      }, 50);
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to create page from template"),
        color: "red",
      });
    },
  });
}
