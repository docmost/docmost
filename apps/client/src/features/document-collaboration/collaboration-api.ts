import api from "@/lib/api-client";
import { useAtomValue } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";

export interface SourcePage {
  id: string;
  title: string;
  slugId: string;
  spaceSlug: string;
}
export interface Member {
  id: string;
  name: string;
  email?: string;
}
export interface DocumentTask {
  id: string;
  pageId: string;
  title: string;
  creatorId: string;
  assigneeId: string;
  dueAt: string | null;
  status: "pending" | "completed" | "cancelled";
  completedAt: string | null;
  createdAt: string;
  page: SourcePage;
  creator?: Member;
  assignee?: Member;
  overdue: boolean;
  canManage: boolean;
  canComplete: boolean;
}
export interface Snapshot {
  title: string;
  content: any;
  textContent: string;
  contentHash: string;
  sourceUpdatedAt: string;
}
export interface ReadingBatch {
  id: string;
  title: string;
  pageId: string;
  creatorId: string;
  createdAt: string;
  status: "open" | "closed" | "revoked";
  closedAt: string | null;
  page: SourcePage;
  creator?: Member;
  canManage: boolean;
  isRecipient: boolean;
  myConfirmedAt: string | null;
  total?: number;
  confirmed?: number;
  snapshot?: Snapshot;
  recipients?: {
    id: string;
    userId: string | null;
    name: string;
    confirmedAt: string | null;
  }[];
}
export interface ResultPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore?: boolean;
}
export async function collaborationPost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  return (await api.post<T>(`/document-collaboration/${path}`, body)).data;
}
export function errorMessage(error: any): string {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join("；");
  return typeof message === "string"
    ? message
    : "操作失败，请重试或检查文档权限";
}
export function useCollaborationIdentity() {
  const current = useAtomValue(currentUserAtom);
  return { workspaceId: current?.workspace?.id, userId: current?.user?.id };
}
export function useCollaborationList<T>(
  path: string,
  params: Record<string, unknown>,
) {
  const { workspaceId, userId } = useCollaborationIdentity();
  return useInfiniteQuery({
    queryKey: ["document-collaboration", workspaceId, userId, path, params],
    queryFn: ({ pageParam }) =>
      collaborationPost<ResultPage<T>>(path, {
        ...params,
        cursor: pageParam,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor || undefined,
    enabled: !!workspaceId && !!userId,
    refetchInterval: 15000,
    staleTime: 0,
  });
}
export function useCollaborationAction() {
  const client = useQueryClient();
  const { workspaceId, userId } = useCollaborationIdentity();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      collaborationPost(path, body),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["document-collaboration", workspaceId, userId],
      });
    },
    onError: (error) =>
      notifications.show({
        color: "red",
        title: "操作未完成",
        message: errorMessage(error),
      }),
  });
}
export function formatTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("zh-CN", { hour12: false })
    : "未设置";
}
export function sourceUrl(page: SourcePage) {
  return `/s/${page.spaceSlug}/p/${page.slugId}`;
}
