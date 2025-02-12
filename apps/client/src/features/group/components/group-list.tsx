import { Table, Group, Text, Anchor } from "@mantine/core";
import { useGetGroupsQuery } from "@/features/group/queries/group-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { IconGroupCircle } from "@/components/icons/icon-people-circle.tsx";
import { useTranslation } from "react-i18next";
import { formatMemberCount } from "@/lib";
import { IGroup } from "@/features/group/types/group.types.ts";
import Paginate from "@/components/common/paginate.tsx";

export default function GroupList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetGroupsQuery({ page });

  return (
    <>
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm" layout="fixed">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Group")}</Table.Th>
              <Table.Th>{t("Members")}</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.map((group: IGroup, index: number) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Anchor
                    size="sm"
                    underline="never"
                    style={{
                      cursor: "pointer",
                      color: "var(--mantine-color-text)",
                    }}
                    component={Link}
                    to={`/settings/groups/${group.id}`}
                  >
                    <Group gap="sm" wrap="nowrap">
                      <IconGroupCircle />
                      <div>
                        <Text fz="sm" fw={500} lineClamp={1}>
                          {group.name}
                        </Text>
                        <Text fz="xs" c="dimmed" lineClamp={2}>
                          {group.description}
                        </Text>
                      </div>
                    </Group>
                  </Anchor>
                </Table.Td>
                <Table.Td>
                  <Anchor
                    size="sm"
                    underline="never"
                    style={{
                      cursor: "pointer",
                      color: "var(--mantine-color-text)",
                      whiteSpace: "nowrap",
                    }}
                    component={Link}
                    to={`/settings/groups/${group.id}`}
                  >
                    {formatMemberCount(group.memberCount, t)}
                  </Anchor>
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
    </>
  );
}
