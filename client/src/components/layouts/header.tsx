import {
  ActionIcon,
  Menu,
  Button,
  rem,
} from '@mantine/core';
import {
  IconDots,
  IconFileInfo,
  IconHistory,
  IconLink,
  IconLock,
  IconShare,
  IconTrash,
  IconMessage,
} from '@tabler/icons-react';
import React from 'react';

export default function Header() {
  return (
    <>
      <Button variant="default" style={{ border: 'none' }} size="compact-sm">
        Share
      </Button>

      <ActionIcon variant="default" style={{ border: 'none' }}>
        <IconMessage size={20} stroke={2} />
      </ActionIcon>

      <PageActionMenu />
    </>
  );
}

function PageActionMenu() {
  return (
    <Menu
      shadow="xl"
      position="bottom-end"
      offset={20}
      width={200}
      withArrow
      arrowPosition="center"
    >
      <Menu.Target>
        <ActionIcon variant="default" style={{ border: 'none' }}>
          <IconDots size={20} stroke={2} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={
            <IconFileInfo style={{ width: rem(14), height: rem(14) }} />
          }
        >
          Page info
        </Menu.Item>
        <Menu.Item
          leftSection={<IconLink style={{ width: rem(14), height: rem(14) }} />}
        >
          Copy link
        </Menu.Item>
        <Menu.Item
          leftSection={
            <IconShare style={{ width: rem(14), height: rem(14) }} />
          }
        >
          Share
        </Menu.Item>
        <Menu.Item
          leftSection={
            <IconHistory style={{ width: rem(14), height: rem(14) }} />
          }
        >
          Page history
        </Menu.Item>

        <Menu.Divider />
        <Menu.Item
          leftSection={<IconLock style={{ width: rem(14), height: rem(14) }} />}
        >
          Lock
        </Menu.Item>
        <Menu.Item
          leftSection={
            <IconTrash style={{ width: rem(14), height: rem(14) }} />
          }
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
