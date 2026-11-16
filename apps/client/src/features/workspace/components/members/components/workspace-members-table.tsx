import { Group, Table, Text, Badge } from "@mantine/core";
import {
  useChangeMemberRoleMutation,
  useWorkspaceMembersQuery,
} from "@/features/workspace/queries/workspace-query.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import React, { useState } from "react";
import RoleSelectMenu from "@/components/ui/role-select-menu.tsx";
import {
  getUserRoleLabel,
  userRoleData,
} from "@/features/workspace/types/user-role-data.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { UserRole } from "@/lib/types.ts";
import { useTranslation } from "react-i18next";
import Paginate from "@/components/common/paginate.tsx";
import { SearchInput } from "@/components/common/search-input.tsx";
import NoTableResults from "@/components/common/no-table-results.tsx";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search.tsx";
import MemberActionMenu from "@/features/workspace/components/members/components/members-action-menu.tsx";
import MemberStatusFilter from "@/features/workspace/components/members/components/member-status-filter.tsx";
import { MemberListStatus } from "@/features/workspace/types/workspace.types.ts";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale.ts";

export default function WorkspaceMembersTable() {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { search, cursor, goNext, goPrev, handleSearch, resetPagination } =
    usePaginateAndSearch();
  const [status, setStatus] = useState<MemberListStatus>("active");
  const { data, isLoading } = useWorkspaceMembersQuery({
    cursor,
    limit: 100,
    query: search,
    status,
  });
  const changeMemberRoleMutation = useChangeMemberRoleMutation();
  const { isAdmin, isOwner } = useUserRole();

  const handleStatusChange = (value: MemberListStatus) => {
    setStatus(value);
    resetPagination();
  };

  const assignableUserRoles = isOwner
    ? userRoleData
    : userRoleData.filter((role) => role.value !== UserRole.OWNER);

  const handleRoleChange = async (
    userId: string,
    currentRole: string,
    newRole: string,
  ) => {
    if (newRole === currentRole) {
      return;
    }

    const memberRoleUpdate = {
      userId: userId,
      role: newRole,
    };

    await changeMemberRoleMutation.mutateAsync(memberRoleUpdate);
  };

  return (
    <>
      <Group gap="sm" align="flex-start">
        <SearchInput onSearch={handleSearch} />
        {isAdmin && (
          <MemberStatusFilter status={status} onChange={handleStatusChange} />
        )}
      </Group>
      <Table.ScrollContainer minWidth={600}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("User")}</Table.Th>
              <Table.Th>{t("Status")}</Table.Th>
              <Table.Th>{t("Role")}</Table.Th>
              <Table.Th aria-label={t("Action")} />
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.length > 0 ? (
              data?.items.map((user, index) => (
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
                          {user.deletedAt
                            ? t("Deleted on {{date}}", {
                                date: formatLocalized(
                                  user.deletedAt,
                                  "MMM d, yyyy",
                                  "PP",
                                  locale,
                                ),
                              })
                            : user.email}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {user.deletedAt ? (
                      <Badge variant="light" color="red">
                        {t("Deleted")}
                      </Badge>
                    ) : user.deactivatedAt ? (
                      <Badge variant="light" color="orange">
                        {t("Deactivated")}
                      </Badge>
                    ) : (
                      <Badge variant="light">{t("Active")}</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {isAdmin && !user.deletedAt ? (
                      <RoleSelectMenu
                        roles={assignableUserRoles}
                        roleName={getUserRoleLabel(user.role)}
                        onChange={(newRole) =>
                          handleRoleChange(user.id, user.role, newRole)
                        }
                      />
                    ) : (
                      <Text fz="sm">{t(getUserRoleLabel(user.role))}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {isAdmin && !user.deletedAt && (
                      <MemberActionMenu
                        userId={user.id}
                        name={user.name}
                        deactivatedAt={user.deactivatedAt}
                      />
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
