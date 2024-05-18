import React, { ReactNode, useState } from "react";
import {
  Group,
  Box,
  Collapse,
  ThemeIcon,
  UnstyledButton,
  rem,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import classes from "./tree-collapse.module.css";

interface TreeCollapseProps {
  icon?: React.FC<any>;
  label: string;
  initiallyOpened?: boolean;
  children: ReactNode;
}

export function TreeCollapse({
  icon: Icon,
  label,
  initiallyOpened,
  children,
}: TreeCollapseProps) {
  const [opened, setOpened] = useState(initiallyOpened || false);

  return (
    <>
      <UnstyledButton
        onClick={() => setOpened((o) => !o)}
        className={classes.control}
      >
        <Group justify="space-between" gap={0}>
          <Box style={{ display: "flex", alignItems: "center" }}>
            <ThemeIcon variant="light" size={20}>
              <Icon style={{ width: rem(18), height: rem(18) }} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
          </Box>

          <IconChevronRight
            className={classes.chevron}
            stroke={1.5}
            style={{
              width: rem(16),
              height: rem(16),
              transform: opened ? "rotate(90deg)" : "none",
            }}
          />
        </Group>
      </UnstyledButton>

      <Collapse in={opened}>
        <div className={classes.item}>{children}</div>
      </Collapse>
    </>
  );
}
