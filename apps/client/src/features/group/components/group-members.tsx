import { Group, Table, Text, Badge, Menu, ActionIcon } from "@mantine/core";
import {
  useGroupMembersQuery,
  useRemoveGroupMemberMutation,
} from "@/features/group/queries/group-query";
import { useParams } from "react-router-dom";
import React from "react";
import { IconDots } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { UserAvatar } from "@/components/ui/user-avatar.tsx";

export default function GroupMembersList() {
  const { groupId } = useParams();
  const { data, isLoading } = useGroupMembersQuery(groupId);
  const removeGroupMember = useRemoveGroupMemberMutation();

  const onRemove = async (userId: string) => {
    const memberToRemove = {
      groupId: groupId,
      userId: userId,
    };
    await removeGroupMember.mutateAsync(memberToRemove);
  };

  const openRemoveModal = (userId: string) =>
    modals.openConfirmModal({
      title: "Remove group member",
      children: (
        <Text size="sm">
          Are you sure you want to remove this user from the group? The user
          will lose access to resources this group has access to.
        </Text>
      ),
      centered: true,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => onRemove(userId),
    });

  return (
    <>
      {data && (
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>User</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th></Table.Th>
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
                  <Menu
                    shadow="xl"
                    position="bottom-end"
                    offset={20}
                    width={200}
                    withArrow
                    arrowPosition="center"
                  >
                    <Menu.Target>
                      <ActionIcon variant="subtle" c="gray">
                        <IconDots size={20} stroke={2} />
                      </ActionIcon>
                    </Menu.Target>

                    <Menu.Dropdown>
                      <Menu.Item onClick={() => openRemoveModal(user.id)}>
                        Remove group member
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
