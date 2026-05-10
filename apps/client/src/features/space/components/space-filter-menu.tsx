import { ReactNode, useMemo, useState } from "react";
import {
  Avatar,
  Divider,
  Group,
  Menu,
  ScrollArea,
  Text,
  TextInput,
  getDefaultZIndex,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";

type SpaceFilterMenuProps = {
  value: string | null;
  onChange: (spaceId: string | null) => void;
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
};

export function SpaceFilterMenu({
  value,
  onChange,
  children,
  width = 280,
  position = "bottom-end",
  zIndex,
}: SpaceFilterMenuProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);

  const { data: spacesData } = useGetSpacesQuery({
    limit: 100,
    query: debouncedQuery,
  });
  const spaces = spacesData?.items ?? [];

  const orderedSpaces = useMemo(() => {
    if (!value) return spaces;
    return [...spaces].sort((a, b) => {
      if (a.id === value) return -1;
      if (b.id === value) return 1;
      return 0;
    });
  }, [spaces, value]);

  return (
    <Menu shadow="md" width={width} position={position} zIndex={zIndex}>
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown>
        <TextInput
          placeholder={t("Find a space")}
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
          <Menu.Item onClick={() => onChange(null)}>
            <Group flex="1" gap="xs">
              <Avatar
                color="initials"
                variant="filled"
                name={t("All spaces")}
                size={20}
              />
              <div style={{ flex: 1 }}>
                <Text size="sm" fw={500}>
                  {t("All spaces")}
                </Text>
                <Text size="xs" c="dimmed">
                  {t("Search in all your spaces")}
                </Text>
              </div>
              {!value && <IconCheck size={20} />}
            </Group>
          </Menu.Item>

          <Divider my="xs" />

          {orderedSpaces.map((space) => (
            <Menu.Item key={space.id} onClick={() => onChange(space.id)}>
              <Group flex="1" gap="xs">
                <Avatar
                  color="initials"
                  variant="filled"
                  name={space.name}
                  size={20}
                />
                <Text size="sm" fw={500} style={{ flex: 1 }} truncate>
                  {space.name}
                </Text>
                {value === space.id && <IconCheck size={20} />}
              </Group>
            </Menu.Item>
          ))}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
}

export const SPACE_FILTER_MENU_MAX_Z = getDefaultZIndex("max");
