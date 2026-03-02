import { Menu, ActionIcon, Text } from "@mantine/core";
import React from "react";
import { IconDots, IconTrash, IconUserOff, IconUserCheck } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import {
  useDeleteWorkspaceMemberMutation,
  useDeactivateWorkspaceMemberMutation,
  useActivateWorkspaceMemberMutation,
} from "@/features/workspace/queries/workspace-query.ts";
import { useTranslation } from "react-i18next";
import useUserRole from "@/hooks/use-user-role.tsx";

interface Props {
  userId: string;
  deactivatedAt: Date | null;
}
export default function MemberActionMenu({ userId, deactivatedAt }: Props) {
  const { t } = useTranslation();
  const deleteWorkspaceMemberMutation = useDeleteWorkspaceMemberMutation();
  const deactivateMutation = useDeactivateWorkspaceMemberMutation();
  const activateMutation = useActivateWorkspaceMemberMutation();
  const { isAdmin } = useUserRole();

  const isDeactivated = !!deactivatedAt;

  const onDeactivate = async () => {
    await deactivateMutation.mutateAsync({ userId });
  };

  const onActivate = async () => {
    await activateMutation.mutateAsync({ userId });
  };

  const openDeactivateModal = () =>
    modals.openConfirmModal({
      title: isDeactivated ? t("Activate member") : t("Deactivate member"),
      children: (
        <Text size="sm">
          {isDeactivated
            ? t("Are you sure you want to activate this workspace member?")
            : t(
                "Are you sure you want to deactivate this workspace member? They will no longer be able to access this workspace.",
              )}
        </Text>
      ),
      centered: true,
      labels: {
        confirm: isDeactivated ? t("Activate") : t("Deactivate"),
        cancel: t("Cancel"),
      },
      confirmProps: { color: isDeactivated ? "blue" : "orange" },
      onConfirm: isDeactivated ? onActivate : onDeactivate,
    });

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
            onClick={openDeactivateModal}
            leftSection={
              isDeactivated ? (
                <IconUserCheck size={16} />
              ) : (
                <IconUserOff size={16} />
              )
            }
            disabled={!isAdmin}
          >
            {isDeactivated ? t("Activate member") : t("Deactivate member")}
          </Menu.Item>

          <Menu.Divider />

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
