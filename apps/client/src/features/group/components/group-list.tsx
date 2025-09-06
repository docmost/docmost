import { Table, Group, Text, Anchor } from "@mantine/core";
import { useGetGroupsQuery } from "@/features/group/queries/group-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { IconGroupCircle } from "@/components/icons/icon-people-circle.tsx";
import { useTranslation } from "react-i18next";
import { formatMemberCount } from "@/lib";
import { IGroup } from "@/features/group/types/group.types.ts";
import Paginate from "@/components/common/paginate.tsx";
import { queryClient } from "@/main.tsx";
import { getSpaces } from "@/features/space/services/space-service.ts";
import { getGroupMembers } from "@/features/group/services/group-service.ts";
import useUserRole from "@/hooks/use-user-role.tsx";

export default function GroupList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetGroupsQuery({ page });
  const { isAdmin } = useUserRole();

  const prefetchGroupMembers = (groupId: string) => {
    queryClient.prefetchQuery({
      queryKey: ["groupMembers", groupId, { page: 1 }],
      queryFn: () => getGroupMembers(groupId, { page: 1 }),
    });
  };

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
            {data?.items.map((group: IGroup, index: number) => {
              const groupDisplay = (
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
              );

              return (
                <Table.Tr key={index}>
                  <Table.Td onMouseEnter={() => prefetchGroupMembers(group.id)}>
                    {isAdmin ? (
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
                        {groupDisplay}
                      </Anchor>
                    ) : (
                      groupDisplay
                    )}
                  </Table.Td>
                  <Table.Td>
                    {isAdmin ? (
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
                    ) : (
                      formatMemberCount(group.memberCount, t)
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
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
