import { Table, Group, Text, Anchor } from "@mantine/core";
import { useGetGroupsQuery } from "@/features/group/queries/group-query";
import { Link } from "react-router-dom";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import { IconGroupCircle } from "@/components/icons/icon-people-circle.tsx";
import { useTranslation } from "react-i18next";
import { formatMemberCount } from "@/lib";
import { IGroup } from "@/features/group/types/group.types.ts";
import Paginate from "@/components/common/paginate.tsx";
import { queryClient } from "@/main.tsx";
import { getGroupMembers } from "@/features/group/services/group-service.ts";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text.tsx";

export default function GroupList() {
  const { t } = useTranslation();
  const { cursor, goNext, goPrev } = useCursorPaginate();
  const { data, isLoading } = useGetGroupsQuery({ cursor });

  const prefetchGroupMembers = (groupId: string) => {
    queryClient.prefetchQuery({
      queryKey: ["groupMembers", groupId, {}],
      queryFn: () => getGroupMembers(groupId, {}),
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
            {data?.items.map((group: IGroup, index: number) => (
              <Table.Tr key={index}>
                <Table.Td onMouseEnter={() => prefetchGroupMembers(group.id)}>
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
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <AutoTooltipText fz="sm" fw={500} lineClamp={1}>
                          {group.name}
                        </AutoTooltipText>
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
          hasPrevPage={data?.meta?.hasPrevPage}
          hasNextPage={data?.meta?.hasNextPage}
          onNext={() => goNext(data?.meta?.nextCursor)}
          onPrev={goPrev}
        />
      )}
    </>
  );
}
