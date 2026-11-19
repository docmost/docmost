import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api-client";
import type { IPagination } from "@/lib/types";

export type TaskView = "assigned" | "created";
export type PageTask = {
  id: string;
  blockId: string;
  title: string;
  checked: boolean;
  canEdit: boolean;
  dueDate: string | null;
  pageTitle: string | null;
  pageSlugId: string;
  spaceName: string;
  spaceSlug: string;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  assigneeName: string | null;
  assigneeAvatarUrl: string | null;
};

export function useTasks(view: TaskView, checked: boolean) {
  return useInfiniteQuery({
    queryKey: ["tasks", view, checked],
    queryFn: async ({ pageParam }) => {
      const { data } = await api.post<IPagination<PageTask>>("/tasks/list", {
        view,
        checked,
        cursor: pageParam,
      });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.meta.hasNextPage ? page.meta.nextCursor : undefined,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 60000,
  });
}

export function useSetTaskChecked() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (params: { taskId: string; checked: boolean }) =>
      api.post("/tasks/set-checked", params),
    onSettled: () => client.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export type TaskActivityItem = Pick<
  PageTask,
  | "title"
  | "checked"
  | "blockId"
  | "spaceSlug"
  | "spaceName"
  | "pageSlugId"
  | "pageTitle"
  | "dueDate"
> & {
  taskId: string;
  kind: "assigned" | "completed" | "reopened";
};

export function useTaskActivity(batchId: string) {
  return useInfiniteQuery({
    queryKey: ["tasks", "activity", batchId],
    queryFn: async ({ pageParam }) => {
      const { data } = await api.post<IPagination<TaskActivityItem>>(
        "/tasks/activity",
        { batchId, cursor: pageParam },
      );
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.meta.hasNextPage ? page.meta.nextCursor : undefined,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 60000,
  });
}
