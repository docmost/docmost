import { Menu, ActionIcon, Text } from "@mantine/core";
import React from "react";
import { IconDots, IconTrash } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import {
  useResendInvitationMutation,
  useRevokeInvitationMutation,
} from "@/features/workspace/queries/workspace-query.ts";
import { useTranslation } from "react-i18next";

interface Props {
  invitationId: string;
}
export default function InviteActionMenu({ invitationId }: Props) {
  const { t } = useTranslation();
  const resendInvitationMutation = useResendInvitationMutation();
  const revokeInvitationMutation = useRevokeInvitationMutation();

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
          <Menu.Item onClick={onResend}>{t("Resend invitation")}</Menu.Item>
          <Menu.Divider />
          <Menu.Item
            c="red"
            onClick={openRevokeModal}
            leftSection={<IconTrash size={16} stroke={2} />}
          >
            {t("Revoke invitation")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
