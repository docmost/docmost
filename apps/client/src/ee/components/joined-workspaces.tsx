import { Group, Text, UnstyledButton } from "@mantine/core";
import { useJoinedWorkspacesQuery } from "../cloud/query/cloud-query";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import classes from "./joined-workspaces.module.css";
import { IconChevronRight } from "@tabler/icons-react";
import { getHostnameUrl } from "@/ee/utils.ts";
import { Link } from "react-router-dom";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";

export default function JoinedWorkspaces() {
  const { data, isLoading } = useJoinedWorkspacesQuery();
  if (isLoading || !data || data?.length === 0) {
    return null;
  }

  return (
    <>
      {data
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((workspace: Partial<IWorkspace>, index) => (
          <UnstyledButton
            key={index}
            component={Link}
            to={getHostnameUrl(workspace?.hostname) + "/home"}
            className={classes.workspace}
          >
            <Group wrap="nowrap">
              <CustomAvatar
                avatarUrl={workspace?.logo}
                name={workspace?.name}
                variant="filled"
                size="md"
              />

              <div style={{ flex: 1 }}>
                <Text size="sm" fw={500} lineClamp={1}>
                  {workspace?.name}
                </Text>

                <Text c="dimmed" size="sm">
                  {getHostnameUrl(workspace?.hostname)?.split("//")[1]}
                </Text>
              </div>

              <IconChevronRight size={16} />
            </Group>
          </UnstyledButton>
        ))}
    </>
  );
}
