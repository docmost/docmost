import {Table, Group, Text, Avatar} from "@mantine/core";
import React, {useState} from "react";
import {useGetSpacesQuery} from "@/features/space/queries/space-query.ts";
import SpaceSettingsModal from "@/features/space/components/settings-modal.tsx";
import { useDisclosure } from "@mantine/hooks";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";

export default function SpaceList() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetSpacesQuery();
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(null);

  const handleClick = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    open();
  };

  return (
    <>
      {data && (
        <Table.ScrollContainer minWidth={400}>
          <Table highlightOnHover verticalSpacing="sm">
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
                  style={{cursor: "pointer"}}
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
                    <Text size="sm" style={{whiteSpace: 'nowrap'}}>{formatMemberCount(space.memberCount)}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
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
