import { ThemeIcon } from "@mantine/core";
import React from "react";
import { IconUsersGroup } from "@tabler/icons-react";

export function IconGroupCircle() {
  return (
    <ThemeIcon variant="light" size="lg" color="gray" radius="xl">
      <IconUsersGroup stroke={1.5} />
    </ThemeIcon>
  );
}
