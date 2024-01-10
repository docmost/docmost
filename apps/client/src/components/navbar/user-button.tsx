import { UnstyledButton, Group, Avatar, Text, rem } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import classes from './user-button.module.css';
import { useAtom } from 'jotai/index';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';

export function UserButton() {
  const [currentUser] = useAtom(currentUserAtom);

  return (
    <UnstyledButton className={classes.user}>
      <Group>
        <Avatar
          src="https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/avatars/avatar-9.png"
          radius="xl"
        />

        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            {currentUser?.user.name}
          </Text>

          <Text c="dimmed" size="xs">
            {currentUser?.user.email}
          </Text>
        </div>

        <IconChevronRight style={{ width: rem(14), height: rem(14) }} stroke={1.5} />
      </Group>
    </UnstyledButton>
  );
}
