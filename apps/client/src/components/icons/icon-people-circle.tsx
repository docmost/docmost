import { ActionIcon, rem } from "@mantine/core";
import React from "react";
import { IconUsersGroup } from "@tabler/icons-react";

export function IconGroupCircle() {
  return (
    <ActionIcon variant="light" size="lg" color="gray" radius="xl">
      <IconUsersGroup stroke={1.5} />
    </ActionIcon>
  );
}
