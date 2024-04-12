import { Group, Table, Avatar, Text, Badge } from "@mantine/core";
import {
  useChangeMemberRoleMutation,
  useWorkspaceMembersQuery,
} from "@/features/workspace/queries/workspace-query.ts";
import { UserAvatar } from "@/components/ui/user-avatar.tsx";
import React from "react";
import RoleSelectMenu from "@/components/ui/role-select-menu.tsx";
import {
  getUserRoleLabel,
  userRoleData,
} from "@/features/workspace/types/user-role-data.ts";

export default function WorkspaceMembersTable() {
  const { data, isLoading } = useWorkspaceMembersQuery();
  const changeMemberRoleMutation = useChangeMemberRoleMutation();

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
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>User</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Role</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.map((user, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Group gap="sm">
                    <UserAvatar avatarUrl={user.avatarUrl} name={user.name} />
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
                  <Badge variant="light">Active</Badge>
                </Table.Td>

                <Table.Td>
                  <RoleSelectMenu
                    roles={userRoleData}
                    roleName={getUserRoleLabel(user.role)}
                    onChange={(newRole) =>
                      handleRoleChange(user.id, user.role, newRole)
                    }
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
