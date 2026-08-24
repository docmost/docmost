import { ReactNode, useState } from "react";
import { Divider, Group, Menu, ScrollArea, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query";
import { RadioMenuItem } from "@/components/ui/radio-menu-item";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { IUser } from "@/features/user/types/user.types.ts";

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

          {users.length === 0 && (
            <Text size="xs" c="dimmed" px="xs" py="sm">
              {isLoading ? t("Loading...") : t("No users found")}
            </Text>
          )}

          {users.map((user) => (
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
