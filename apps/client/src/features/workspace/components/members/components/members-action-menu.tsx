import { Menu, ActionIcon, Text } from "@mantine/core";
import React from "react";
import { IconDots, IconTrash, IconPassword } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { useDeleteWorkspaceMemberMutation } from "@/features/workspace/queries/workspace-query.ts";
import { useTranslation } from "react-i18next";
import useUserRole from "@/hooks/use-user-role.tsx";
import ChangeUserPasswordForm from "@/features/workspace/components/members/components/change-user-password.tsx";

interface Props {
  userId: string;
  userName: string;
}
export default function MemberActionMenu({ userId, userName }: Props) {
  const { t } = useTranslation();
  const deleteWorkspaceMemberMutation = useDeleteWorkspaceMemberMutation();
  const { isAdmin } = useUserRole();

  const onRevoke = async () => {
    await deleteWorkspaceMemberMutation.mutateAsync({ userId });
  };

  const openRevokeModal = () =>
    modals.openConfirmModal({
      title: t("Delete member"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to delete this workspace member? This action is irreversible.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Don't") },
      confirmProps: { color: "red" },
      onConfirm: onRevoke,
    });

  const openChangePasswordModal = () =>
    modals.open({
      title: t("Change password for {{userName}}", { userName }),
      children: (
        <ChangeUserPasswordForm
          userId={userId}
          userName={userName}
          onClose={() => modals.closeAll()}
        />
      ),
      centered: true,
    });
  return (
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
          <ActionIcon variant="subtle" c="gray">
            <IconDots size={20} stroke={2} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            onClick={openChangePasswordModal}
            leftSection={<IconPassword size={16} />}
            disabled={!isAdmin}
          >
            {t("Change password")}
          </Menu.Item>
          
          <Menu.Item
            c="red"
            onClick={openRevokeModal}
            leftSection={<IconTrash size={16} />}
            disabled={!isAdmin}
          >
            {t("Delete member")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
