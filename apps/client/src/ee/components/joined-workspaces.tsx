import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import {
  useJoinedWorkspacesQuery,
  useRemoveJoinedWorkspaceMutation,
} from "../cloud/query/cloud-query";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import classes from "./joined-workspaces.module.css";
import { IconChevronRight, IconX } from "@tabler/icons-react";
import { getHostnameUrl } from "@/ee/utils.ts";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function JoinedWorkspaces() {
  const { t } = useTranslation();
  const { data, isLoading } = useJoinedWorkspacesQuery();
  const removeMutation = useRemoveJoinedWorkspaceMutation();

  if (isLoading || !data || data?.length === 0) {
    return null;
  }

  return (
    <>
      {data.map((workspace) => {
        const workspaceUrl = getHostnameUrl(workspace?.hostname);

        return (
          <div key={workspace.id} className={classes.workspace}>
            <Group wrap="nowrap">
              <CustomAvatar
                avatarUrl={workspace?.logo}
                name={workspace?.name}
                variant="filled"
                size="md"
              />

              <Link to={workspaceUrl + "/home"} className={classes.link}>
                <Text size="sm" fw={500} lineClamp={1}>
                  {workspace?.name}
                </Text>

                <Text c="dimmed" size="sm">
                  {workspaceUrl?.split("//")[1]}
                </Text>
              </Link>

              <IconChevronRight size={16} />
            </Group>

            <Tooltip label={t("Remove from list")} withArrow>
              <ActionIcon
                variant="default"
                size="sm"
                radius="xl"
                className={classes.remove}
                aria-label={t("Remove {{name}} from list", {
                  name: workspace?.name,
                })}
                loading={
                  removeMutation.isPending &&
                  removeMutation.variables === workspace.id
                }
                onClick={() => removeMutation.mutate(workspace.id)}
              >
                <IconX size={12} />
              </ActionIcon>
            </Tooltip>
          </div>
        );
      })}
    </>
  );
}
