import { ActionIcon, Menu } from '@mantine/core';
import { IconDots, IconEdit, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';

type CommentMenuProps = {
  onEditComment: () => void;
  onDeleteComment: () => void;
};

function CommentMenu({ onEditComment, onDeleteComment }: CommentMenuProps) {

  //@ts-ignore
  const openDeleteModal = () =>
    modals.openConfirmModal({
      title: 'Are you sure you want to delete this comment?',
      centered: true,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: onDeleteComment,
    });

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <ActionIcon variant="default" style={{ border: 'none' }}>
          <IconDots size={20} stroke={2} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item onClick={onEditComment}
                   leftSection={<IconEdit size={14} />}>
          Edit comment
        </Menu.Item>
        <Menu.Item leftSection={<IconTrash size={14} />}
                   onClick={openDeleteModal}
        >
          Delete comment
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export default CommentMenu;
