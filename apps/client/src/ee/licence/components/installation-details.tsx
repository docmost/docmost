import React from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import classes from "@/ee/billing/components/billing.module.css";
import {
  Group,
  Paper,
  SimpleGrid,
  Text,
  TextInput,
} from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import CopyTextButton from "@/components/common/copy.tsx";

export default function InstallationDetails() {
  const { isAdmin } = useUserRole();
  const [workspace] = useAtom(workspaceAtom);

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 2 }}>
        <Paper p="sm" radius="md" withBorder={true}>
          <Group justify="apart" grow>
            <div>
              <Text
                c="dimmed"
                tt="uppercase"
                fw={700}
                fz="xs"
                className={classes.label}
              >
                Workspace ID
              </Text>
              <TextInput
                style={{ fontWeight: 700 }}
                variant="unstyled"
                readOnly
                value={workspace?.id}
                pointer
                rightSection={<CopyTextButton text={workspace?.id} />}
              />
            </div>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder={true}>
          <Group justify="apart">
            <div>
              <Text
                c="dimmed"
                tt="uppercase"
                fw={700}
                fz="xs"
                className={classes.label}
              >
                Member count
              </Text>
              <Text fw={700} fz="lg" tt="capitalize">
                {workspace?.memberCount}
              </Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>
    </>
  );
}
