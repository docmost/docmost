import { Avatar, Group, Menu, rem, UnstyledButton, Text } from "@mantine/core";
import {
  IconChevronDown,
  IconLogout,
  IconSettings,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import useAuth from "@/features/auth/hooks/use-auth.ts";
import { UserAvatar } from "@/components/ui/user-avatar.tsx";

export default function TopMenu() {
  const [currentUser] = useAtom(currentUserAtom);
  const { logout } = useAuth();

  const user = currentUser.user;
  const workspace = currentUser.workspace;

  return (
    <Menu width={250} position="bottom-end" withArrow shadow={"lg"}>
      <Menu.Target>
        <UnstyledButton>
          <Group gap={7} wrap={"nowrap"}>
            <Avatar
              src={workspace.logo}
              alt={workspace.name}
              radius="xl"
              size={20}
            />
            <Text fw={500} size="sm" lh={1} mr={3}>
              {workspace.name}
            </Text>
            <IconChevronDown
              style={{ width: rem(12), height: rem(12) }}
              stroke={1.5}
            />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Workspace</Menu.Label>

        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.WORKSPACE.GENERAL}
          leftSection={
            <IconSettings
              style={{ width: rem(16), height: rem(16) }}
              stroke={1.5}
            />
          }
        >
          Workspace settings
        </Menu.Item>

        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.WORKSPACE.MEMBERS}
          leftSection={
            <IconUsers
              style={{ width: rem(16), height: rem(16) }}
              stroke={1.5}
            />
          }
        >
          Manage members
        </Menu.Item>

        <Menu.Divider />

        <Menu.Label>Account</Menu.Label>
        <Menu.Item component={Link} to={APP_ROUTE.SETTINGS.ACCOUNT.PROFILE}>
          <Group wrap={"nowrap"}>
            <UserAvatar
              radius="xl"
              size={"sm"}
              avatarUrl={user.avatarUrl}
              name={user.name}
            />

            <div>
              <Text size="sm" fw={500} lineClamp={1}>
                {user.name}
              </Text>
              <Text size="xs" c="dimmed">
                {user.email}
              </Text>
            </div>
          </Group>
        </Menu.Item>
        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.ACCOUNT.PROFILE}
          leftSection={
            <IconUserCircle
              style={{ width: rem(16), height: rem(16) }}
              stroke={1.5}
            />
          }
        >
          My profile
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          onClick={logout}
          leftSection={
            <IconLogout
              style={{ width: rem(16), height: rem(16) }}
              stroke={1.5}
            />
          }
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
