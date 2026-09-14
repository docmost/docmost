import { Group, Table, Text, Badge, Menu, ActionIcon } from "@mantine/core";
import {
  useGroupMembersQuery,
  useRemoveGroupMemberMutation,
} from "@/features/group/queries/group-query";
import { useParams } from "react-router-dom";
import React from "react";
import { IconDots } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useTranslation } from "react-i18next";
import { IUser } from "@/features/user/types/user.types.ts";
import Paginate from "@/components/common/paginate.tsx";
import { SearchInput } from "@/components/common/search-input.tsx";
import NoTableResults from "@/components/common/no-table-results.tsx";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search.tsx";

export default function GroupMembersList() {
  const { t } = useTranslation();
  const { groupId } = useParams();
  const { search, cursor, goNext, goPrev, handleSearch } =
    usePaginateAndSearch();
  const { data, isLoading } = useGroupMembersQuery(groupId, {
    cursor,
    query: search,
  });
  const removeGroupMember = useRemoveGroupMemberMutation();
  const { isAdmin } = useUserRole();

  const onRemove = async (userId: string) => {
    const memberToRemove = {
      groupId: groupId,
      userId: userId,
    };
    await removeGroupMember.mutateAsync(memberToRemove);
  };

  const openRemoveModal = (userId: string) =>
    modals.openConfirmModal({
      title: t("Remove group member"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to remove this user from the group? The user will lose access to resources this group has access to.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => onRemove(userId),
    });

  return (
    <>
      <SearchInput onSearch={handleSearch} />
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("User")}</Table.Th>
              <Table.Th>{t("Status")}</Table.Th>
              <Table.Th aria-label={t("Action")} />
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.length > 0 ? (
              data?.items.map((user: IUser, index: number) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <CustomAvatar
                        avatarUrl={user.avatarUrl}
                        name={user.name}
                      />
                      <div>
                        <Text fz="sm" fw={500} lineClamp={1}>
                          {user.name}
                        </Text>
                        <Text fz="xs" c="dimmed">
                          {user.email}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">{t("Active")}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {isAdmin && (
                      <Menu
                        shadow="xl"
                        position="bottom-end"
                        offset={20}
                        width={200}
                        withArrow
                        arrowPosition="center"
                      >
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            c="gray"
                            aria-label={t("Member actions for {{name}}", {
                              name: user.name,
                            })}
                          >
                            <IconDots size={20} stroke={2} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item onClick={() => openRemoveModal(user.id)}>
                            {t("Remove group member")}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <NoTableResults colSpan={3} />
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
    </>
  );
}
