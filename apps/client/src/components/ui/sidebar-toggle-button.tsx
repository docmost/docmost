import {
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
} from "@tabler/icons-react";
import {
  ActionIcon,
  BoxProps,
  ElementProps,
  MantineColor,
  MantineSize,
} from "@mantine/core";
import React from "react";

export interface SidebarToggleProps extends BoxProps, ElementProps<"button"> {
  size?: MantineSize | `compact-${MantineSize}` | (string & {});
  color?: MantineColor;
  opened?: boolean;
}

export default function SidebarToggle({
  opened,
  size = "sm",
  ...others
}: SidebarToggleProps) {
  return (
    <ActionIcon size={size} {...others} variant="subtle" color="gray">
      {opened ? (
        <IconLayoutSidebarRightExpand />
      ) : (
        <IconLayoutSidebarRightCollapse />
      )}
    </ActionIcon>
  );
}
