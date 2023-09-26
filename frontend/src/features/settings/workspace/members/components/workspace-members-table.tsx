'use client';

import { useAtom } from 'jotai';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { useQuery } from '@tanstack/react-query';
import { getWorkspaceUsers } from '@/features/workspace/services/workspace-service';
import { Table } from '@mantine/core';

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

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>

            {
              data['users']?.map((user, index) => (
                <Table.Tr key={index}>
                  <Table.Td>{user.name}</Table.Td>
                  <Table.Td>{user.email}</Table.Td>
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
