import { Group, Table, Text } from "@mantine/core";
import React, { useState } from "react";
import {
  useGetSpacesQuery,
  useHasArchivedSpaces,
} from "@/features/space/queries/space-query.ts";
import SpaceSettingsModal from "@/features/space/components/settings-modal.tsx";
import { useDisclosure } from "@mantine/hooks";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";
import Paginate from "@/components/common/paginate.tsx";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text.tsx";
import { SearchInput } from "@/components/common/search-input.tsx";
import NoTableResults from "@/components/common/no-table-results.tsx";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search.tsx";
import rowClasses from "@/components/ui/clickable-table-row.module.css";
import SpaceArchiveFilter from "@/features/space/components/space-archive-filter.tsx";

export default function SpaceList() {
  const { t } = useTranslation();
  const { search, cursor, goNext, goPrev, handleSearch, resetPagination } =
    usePaginateAndSearch();
  const [archived, setArchived] = useState(false);
  const { data, isPlaceholderData } = useGetSpacesQuery({
    cursor,
    query: search,
    archived: archived || undefined,
  });
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(null);

  const handleClick = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    open();
  };

  const handleArchivedChange = (value: boolean) => {
    setArchived(value);
    resetPagination();
  };

  const activeListEmpty =
    !archived && !search && !isPlaceholderData && data?.items.length === 0;
  const hasArchivedSpaces = useHasArchivedSpaces(activeListEmpty);
  const noActiveSpaces = activeListEmpty && hasArchivedSpaces;

  return (
    <>
      <Group gap="sm" align="flex-start">
        <SearchInput onSearch={handleSearch} />
        <SpaceArchiveFilter
          archived={archived}
          onChange={handleArchivedChange}
        />
      </Group>
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm" layout="fixed">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Space")}</Table.Th>
              <Table.Th>{t("Members")}</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.length > 0 ? (
            data?.items.map((space, index) => (
              <Table.Tr
                key={index}
                className={rowClasses.row}
                role="button"
                tabIndex={0}
                aria-label={t("Open settings for {{name}}", { name: space.name })}
                onClick={() => handleClick(space.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleClick(space.id);
                  }
                }}
              >
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <CustomAvatar
                      color="initials"
                      avatarUrl={space.logo}
                      type={AvatarIconType.SPACE_ICON}
                      variant="filled"
                      name={space.name}
                    />
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <AutoTooltipText fz="sm" fw={500} lineClamp={1}>
                        {space.name}
                      </AutoTooltipText>
                      <Text fz="xs" c="dimmed" lineClamp={2}>
                        {space.description}
                      </Text>
                    </div>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" style={{ whiteSpace: "nowrap" }}>
                    {formatMemberCount(space.memberCount, t)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))
            ) : (
              <NoTableResults
                colSpan={2}
                text={
                  noActiveSpaces
                    ? t("No active spaces. Archived spaces are under Archived.")
                    : undefined
                }
              />
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {data?.items.length > 0 && (
        <Paginate
          hasPrevPage={data?.meta?.hasPrevPage}
          hasNextPage={data?.meta?.hasNextPage}
          onNext={() => goNext(data?.meta?.nextCursor)}
          onPrev={goPrev}
        />
      )}

      {selectedSpaceId && (
        <SpaceSettingsModal
          opened={opened}
          onClose={close}
          spaceId={selectedSpaceId}
          showOpenSpace
        />
      )}
    </>
  );
}
