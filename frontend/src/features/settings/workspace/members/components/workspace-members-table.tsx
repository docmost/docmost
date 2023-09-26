'use client';

import { useAtom } from 'jotai';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { useQuery } from '@tanstack/react-query';
import { getWorkspaceUsers } from '@/features/workspace/services/workspace-service';
import { Group, Table, Avatar, Text, Badge } from '@mantine/core';

export default function WorkspaceMembersTable() {
  const [currentUser] = useAtom(currentUserAtom);

  const workspaceUsers = useQuery({
    queryKey: ['workspaceUsers', currentUser.workspace.id],
    queryFn: async () => {
      return await getWorkspaceUsers();
    },
  });

  const { data, isLoading, isSuccess } = workspaceUsers;

  return (
    <>
      {isSuccess &&

        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Role</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>

            {
              data['users']?.map((user, index) => (
                <Table.Tr key={index}>

                  <Table.Td>
                    <Group gap="sm">
                      <Avatar size={40} src={user.name} radius={40} />
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
                    <Badge variant="light">
                      Active
                    </Badge>
                  </Table.Td>

                  <Table.Td>{user.workspaceRole}</Table.Td>
                </Table.Tr>
              ))
            }

          </Table.Tbody>
        </Table>
      }
    </>
  );
}
