import { Group, Table, Avatar, Text, Badge } from "@mantine/core";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query.ts";
import { UserAvatar } from "@/components/ui/user-avatar.tsx";
import React from "react";

export default function WorkspaceMembersTable() {
  const { data, isLoading } = useWorkspaceMembersQuery();

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

                <Table.Td>{user.role}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
