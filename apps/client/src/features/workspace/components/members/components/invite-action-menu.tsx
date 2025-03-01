import { Menu, ActionIcon, Text } from "@mantine/core";
import React from "react";
import { IconCopy, IconDots, IconSend, IconTrash } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import {
  useResendInvitationMutation,
  useRevokeInvitationMutation,
} from "@/features/workspace/queries/workspace-query.ts";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { useClipboard } from "@mantine/hooks";
import { getInviteLink } from "@/features/workspace/services/workspace-service.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { isCloud } from "@/lib/config.ts";

interface Props {
  invitationId: string;
}
export default function InviteActionMenu({ invitationId }: Props) {
  const { t } = useTranslation();
  const resendInvitationMutation = useResendInvitationMutation();
  const revokeInvitationMutation = useRevokeInvitationMutation();
  const { isAdmin } = useUserRole();
  const clipboard = useClipboard();

  const handleCopyLink = async (invitationId: string) => {
    try {
      const link = await getInviteLink({ invitationId });
      clipboard.copy(link.inviteLink);
      notifications.show({ message: t("Link copied") });
    } catch (err) {
      notifications.show({
        message: err["response"]?.data?.message,
        color: "red",
      });
    }
  };

  const onResend = async () => {
    await resendInvitationMutation.mutateAsync({ invitationId });
  };

  const onRevoke = async () => {
    await revokeInvitationMutation.mutateAsync({ invitationId });
  };

  const openRevokeModal = () =>
    modals.openConfirmModal({
      title: t("Revoke invitation"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to revoke this invitation? The user will not be able to join the workspace.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Revoke"), cancel: t("Don't") },
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
          {!isCloud() && (
            <Menu.Item
              onClick={() => handleCopyLink(invitationId)}
              leftSection={<IconCopy size={16} />}
              disabled={!isAdmin}
            >
              {t("Copy link")}
            </Menu.Item>
          )}

          <Menu.Item
            onClick={onResend}
            leftSection={<IconSend size={16} />}
            disabled={!isAdmin}
          >
            {t("Resend invitation")}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            c="red"
            onClick={openRevokeModal}
            leftSection={<IconTrash size={16} />}
            disabled={!isAdmin}
          >
            {t("Revoke invitation")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
