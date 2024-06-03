import { UnstyledButton, Group, Avatar, Text, rem } from "@mantine/core";
import classes from "./space-name.module.css";

interface SpaceNameProps {
  spaceName: string;
}
export function SpaceName({ spaceName }: SpaceNameProps) {
  return (
    <UnstyledButton className={classes.spaceName}>
      <Group>
        <div style={{ flex: 1 }}>
          <Text size="md" fw={500} lineClamp={1}>
            {spaceName}
          </Text>
        </div>
      </Group>
    </UnstyledButton>
  );
}
