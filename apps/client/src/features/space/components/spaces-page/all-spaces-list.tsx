import {
  Table,
  Text,
  Group,
  ActionIcon,
  Box,
  Space,
  Menu,
  Avatar,
  Anchor,
} from "@mantine/core";
import { IconDots, IconSettings } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { formatMemberCount } from "@/lib";
import { getSpaceUrl } from "@/lib/config";
import { prefetchSpace } from "@/features/space/queries/space-query";
import { SearchInput } from "@/components/common/search-input";
import Paginate from "@/components/common/paginate";
import NoTableResults from "@/components/common/no-table-results";
import SpaceSettingsModal from "@/features/space/components/settings-modal";
import classes from "./all-spaces-list.module.css";

interface AllSpacesListProps {
  spaces: any[];
  onSearch: (query: string) => void;
  page: number;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
  onPageChange: (page: number) => void;
}

export default function AllSpacesList({
  spaces,
  onSearch,
  page,
  hasPrevPage,
  hasNextPage,
  onPageChange,
}: AllSpacesListProps) {
  const { t } = useTranslation();
  const [settingsOpened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const handleOpenSettings = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    openSettings();
  };

  return (
    <Box>
      <SearchInput onSearch={onSearch} />

      <Space h="md" />

      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Space")}</Table.Th>
              <Table.Th>{t("Members")}</Table.Th>
              <Table.Th w={100}></Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {spaces.length > 0 ? (
              spaces.map((space) => (
                <Table.Tr key={space.id}>
                  <Table.Td>
                    <Anchor
                      size="sm"
                      underline="never"
                      style={{
                        cursor: "pointer",
                        color: "var(--mantine-color-text)",
                      }}
                      component={Link}
                      to={getSpaceUrl(space.slug)}
                    >
                      <Group
                        gap="sm"
                        wrap="nowrap"
                        className={classes.spaceLink}
                        onMouseEnter={() => prefetchSpace(space.slug, space.id)}
                      >
                        <Avatar
                          color="initials"
                          variant="filled"
                          name={space.name}
                          size={40}
                        />
                        <div>
                          <Text fz="sm" fw={500} lineClamp={1}>
                            {space.name}
                          </Text>
                          {space.description && (
                            <Text fz="xs" c="dimmed" lineClamp={2}>
                              {space.description}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ whiteSpace: "nowrap" }}>
                      {formatMemberCount(space.memberCount, t)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconSettings size={16} />}
                            onClick={() => handleOpenSettings(space.id)}
                          >
                            {t("Space settings")}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <NoTableResults colSpan={3} />
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {spaces.length > 0 && (
        <Paginate
          currentPage={page}
          hasPrevPage={hasPrevPage}
          hasNextPage={hasNextPage}
          onPageChange={onPageChange}
        />
      )}

      {selectedSpaceId && (
        <SpaceSettingsModal
          spaceId={selectedSpaceId}
          opened={settingsOpened}
          onClose={closeSettings}
        />
      )}
    </Box>
  );
}
