import { ActionIcon, rem } from "@mantine/core";
import React from "react";
import { IconUsersGroup } from "@tabler/icons-react";

interface IconPeopleCircleProps extends React.ComponentPropsWithoutRef<"svg"> {
  size?: number | string;
}

export function IconGroupCircle() {
  return (
    <ActionIcon variant="light" size="lg" color="gray" radius="xl">
      <IconUsersGroup stroke={1.5} />
    </ActionIcon>
  );
}
