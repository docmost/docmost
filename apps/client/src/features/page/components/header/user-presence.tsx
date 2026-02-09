import { Avatar, Group, Tooltip } from "@mantine/core";
import { useAtomValue } from "jotai";
import { pageUsersAtom } from "@/features/editor/atoms/editor-atoms";

export function UserPresence() {
  const users = useAtomValue(pageUsersAtom);

  if (users.length === 0) return null;

  return (
    <Group gap={4}>
      <Avatar.Group spacing="sm">
        {users.map((state, index) => {
          const user = state.user;
          if (!user) return null;

          return (
            <Tooltip key={index} label={user.name} withArrow>
              <Avatar
                src={user.avatarUrl}
                name={user.name}
                radius="xl"
                size="sm"
                styles={{
                  placeholder: {
                    backgroundColor: user.color || '#e0e0e0',
                    color: "#000000",
                    fontWeight: 700,
                    fontSize: "12px"
                  }
                }}
              >
                {user.name?.charAt(0).toUpperCase()}
              </Avatar>
            </Tooltip>
          );
        })}
      </Avatar.Group>
    </Group>
  );
}
