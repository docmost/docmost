import {
  useDeleteGroupMutation,
  useGroupQuery,
} from "@/features/group/queries/group-query";
import { useNavigate, useParams } from "react-router-dom";
import { Menu, ActionIcon, Text } from "@mantine/core";
import React from "react";
import { IconDots, IconTrash } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import EditGroupModal from "@/features/group/components/edit-group-modal.tsx";
import { modals } from "@mantine/modals";

export default function GroupActionMenu() {
  const { groupId } = useParams();
  const { data: group, isLoading } = useGroupQuery(groupId);
  const deleteGroupMutation = useDeleteGroupMutation();
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);

  const onDelete = async () => {
    await deleteGroupMutation.mutateAsync(groupId);
    navigate("/settings/groups");
  };

  const openDeleteModal = () =>
    modals.openConfirmModal({
      title: "Delete group",
      children: (
        <Text size="sm">
          Are you sure you want to delete this group? Members will lose access
          to resources this group has access to.
        </Text>
      ),
      centered: true,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: onDelete,
    });

  return (
    <>
      {group && (
        <>
          <Menu
            shadow="xl"
            position="bottom-end"
            offset={20}
            width={200}
            withArrow
            arrowPosition="center"
          >
            <Menu.Target>
              <ActionIcon variant="light">
                <IconDots size={20} stroke={2} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item onClick={open} disabled={group.isDefault}>
                Edit group
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                c="red"
                onClick={openDeleteModal}
                disabled={group.isDefault}
                leftSection={<IconTrash size={16} stroke={2} />}
              >
                Delete group
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </>
      )}

      <EditGroupModal opened={opened} onClose={close} />
    </>
  );
}
