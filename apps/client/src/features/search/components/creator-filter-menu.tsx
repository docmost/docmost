import { ReactNode, useMemo, useState } from "react";
import { Divider, Group, Menu, ScrollArea, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query";
import { RadioMenuItem } from "@/components/ui/radio-menu-item";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { IUser } from "@/features/user/types/user.types.ts";
import { useAtomValue } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";

type CreatorFilterMenuProps = {
  value: string | null;
  onChange: (user: IUser | null) => void;
  children: ReactNode;
  width?: number;
  position?:
    | "bottom-start"
    | "bottom-end"
    | "bottom"
    | "top-start"
    | "top-end"
    | "top";
  zIndex?: number;
  opened?: boolean;
  onOpenChange?: (opened: boolean) => void;
};

export function CreatorFilterMenu({
  value,
  onChange,
  children,
  width = 280,
  position = "bottom-end",
  zIndex,
  opened,
  onOpenChange,
}: CreatorFilterMenuProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);

  const { data: suggestion, isLoading } = useSearchSuggestionsQuery({
    query: debouncedQuery,
    includeUsers: true,
    includeGroups: false,
    includePages: false,
    preload: true,
  });

  const users: IUser[] = (suggestion?.users as IUser[]) ?? [];
  const currentUser = useAtomValue(userAtom);

  // pin the signed-in user on top so they never have to search themselves
  const displayUsers = useMemo(() => {
    if (!currentUser) return users;
    const others = users.filter((user) => user.id !== currentUser.id);
    const q = debouncedQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      currentUser.name?.toLowerCase().includes(q) ||
      currentUser.email?.toLowerCase().includes(q);
    return matchesQuery ? [currentUser as IUser, ...others] : users;
  }, [users, currentUser, debouncedQuery]);

  return (
    <Menu
      shadow="md"
      width={width}
      position={position}
      zIndex={zIndex}
      opened={opened}
      onChange={onOpenChange}
    >
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown>
        <TextInput
          placeholder={t("Find a user")}
          data-autofocus
          autoFocus
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="sm"
          variant="filled"
          radius="sm"
          styles={{ input: { marginBottom: 8 } }}
        />

        <ScrollArea.Autosize mah={280}>
          <Menu.Item
            component={RadioMenuItem}
            aria-checked={!value}
            onClick={() => onChange(null)}
          >
            <Group flex="1" gap="xs">
              <div style={{ flex: 1 }}>
                <Text size="sm" fw={500}>
                  {t("Anyone")}
                </Text>
              </div>
              {!value && <IconCheck size={20} aria-hidden />}
            </Group>
          </Menu.Item>

          <Divider my="xs" />

          {displayUsers.length === 0 && (
            <Text size="xs" c="dimmed" px="xs" py="sm">
              {isLoading ? t("Loading...") : t("No users found")}
            </Text>
          )}

          {displayUsers.map((user) => (
            <Menu.Item
              key={user.id}
              component={RadioMenuItem}
              aria-checked={value === user.id}
              onClick={() => onChange(user)}
            >
              <Group flex="1" gap="xs">
                <CustomAvatar
                  avatarUrl={user.avatarUrl}
                  size={20}
                  name={user.name}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>
                    {user.name}
                    {user.id === currentUser?.id && (
                      <Text span size="sm" c="dimmed" fw={400}>
                        {" "}
                        ({t("you")})
                      </Text>
                    )}
                  </Text>
                  {user.email && (
                    <Text size="xs" c="dimmed" truncate>
                      {user.email}
                    </Text>
                  )}
                </div>
                {value === user.id && <IconCheck size={20} aria-hidden />}
              </Group>
            </Menu.Item>
          ))}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
}
