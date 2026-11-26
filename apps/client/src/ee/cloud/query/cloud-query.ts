import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";
import {
  getJoinedWorkspaces,
  removeJoinedWorkspace,
} from "@/ee/cloud/service/cloud-service.ts";

export function useJoinedWorkspacesQuery(): UseQueryResult<
  Partial<IWorkspace[]>,
  Error
> {
  return useQuery({
    queryKey: ["joined-workspaces"],
    queryFn: () => getJoinedWorkspaces(),
  });
}

export function useRemoveJoinedWorkspaceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (workspaceId: string) => removeJoinedWorkspace(workspaceId),
    onSuccess: (_data, workspaceId) => {
      queryClient.setQueryData<Partial<IWorkspace>[]>(
        ["joined-workspaces"],
        (workspaces) => workspaces?.filter((w) => w.id !== workspaceId),
      );
    },
    onError: () => {
      notifications.show({
        message: t("Failed to remove workspace from list"),
        color: "red",
      });
    },
  });
}
