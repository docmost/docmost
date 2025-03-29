import { Table, Group, Text, Avatar } from "@mantine/core";
import React, { useState } from "react";
import { useGetSpacesQuery } from "@/features/space/queries/space-query.ts";
import SpaceSettingsModal from "@/features/space/components/settings-modal.tsx";
import { useDisclosure } from "@mantine/hooks";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";
import Paginate from "@/components/common/paginate.tsx";

export default function SpaceList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetSpacesQuery({ page });
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(null);

  const handleClick = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    open();
  };

  return (
    <>
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm" layout="fixed">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Space")}</Table.Th>
              <Table.Th>{t("Members")}</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.map((space, index) => (
              <Table.Tr
                key={index}
                style={{ cursor: "pointer" }}
                onClick={() => handleClick(space.id)}
              >
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar
                      color="initials"
                      variant="filled"
                      name={space.name}
                    />
                    <div>
                      <Text fz="sm" fw={500} lineClamp={1}>
                        {space.name}
                      </Text>
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
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {data?.items.length > 0 && (
        <Paginate
          currentPage={page}
          hasPrevPage={data?.meta.hasPrevPage}
          hasNextPage={data?.meta.hasNextPage}
          onPageChange={setPage}
        />
      )}

      {selectedSpaceId && (
        <SpaceSettingsModal
          opened={opened}
          onClose={close}
          spaceId={selectedSpaceId}
        />
      )}
    </>
  );
}
