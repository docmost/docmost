import {Group, Table, Text, Badge} from "@mantine/core";
import {
  useChangeMemberRoleMutation,
  useWorkspaceMembersQuery,
} from "@/features/workspace/queries/workspace-query.ts";
import {CustomAvatar} from "@/components/ui/custom-avatar.tsx";
import React from "react";
import RoleSelectMenu from "@/components/ui/role-select-menu.tsx";
import {
  getUserRoleLabel,
  userRoleData,
} from "@/features/workspace/types/user-role-data.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { UserRole } from "@/lib/types.ts";
import { useTranslation } from "react-i18next";

export default function WorkspaceMembersTable() {
  const { t } = useTranslation();
  const { data, isLoading } = useWorkspaceMembersQuery({ limit: 100 });
  const changeMemberRoleMutation = useChangeMemberRoleMutation();
  const {isAdmin, isOwner} = useUserRole();

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
      {data && (
        <Table.ScrollContainer minWidth={500}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("User")}</Table.Th>
                <Table.Th>{t("Status")}</Table.Th>
                <Table.Th>{t("Role")}</Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {data?.items.map((user, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <Group gap="sm">
                      <CustomAvatar avatarUrl={user.avatarUrl} name={user.name}/>
                      <div>
                        <Text fz="sm" fw={500}>
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
                    <RoleSelectMenu
                      roles={assignableUserRoles}
                      roleName={getUserRoleLabel(user.role)}
                      onChange={(newRole) =>
                        handleRoleChange(user.id, user.role, newRole)
                      }
                      disabled={!isAdmin}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </>
  );
}
