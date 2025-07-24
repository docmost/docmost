import { Menu, ActionIcon, Text } from "@mantine/core";
import React from "react";
import { IconDots, IconTrash, IconShieldOff } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { 
  useDeleteWorkspaceMemberMutation,
  useResetUserMfaMutation 
} from "@/features/workspace/queries/workspace-query.ts";
import { useTranslation } from "react-i18next";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useLicense } from "@/ee/hooks/use-license.tsx";
import { isCloud } from "@/lib/config.ts";
import { UserRole } from "@/lib/types.ts";

interface Props {
  userId: string;
  userRole: string;
}
export default function MemberActionMenu({ userId, userRole }: Props) {
  const { t } = useTranslation();
  const deleteWorkspaceMemberMutation = useDeleteWorkspaceMemberMutation();
  const resetUserMfaMutation = useResetUserMfaMutation();
  const { isAdmin, isOwner } = useUserRole();
  const { hasLicenseKey } = useLicense();
  
  // Show MFA reset only for self-hosted enterprise edition
  // Admins cannot reset MFA for owners
  const canResetMfa = isOwner || (isAdmin && userRole !== UserRole.OWNER);
  const showMfaReset = !isCloud() && hasLicenseKey && canResetMfa;

  const onRevoke = async () => {
    await deleteWorkspaceMemberMutation.mutateAsync({ userId });
  };

  const onResetMfa = async () => {
    await resetUserMfaMutation.mutateAsync({ userId });
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

  const openResetMfaModal = () =>
    modals.openConfirmModal({
      title: t("Reset MFA"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to reset MFA for this user? They will need to set up MFA again.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Reset"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: onResetMfa,
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
          {showMfaReset && (
            <Menu.Item
              onClick={openResetMfaModal}
              leftSection={<IconShieldOff size={16} />}
            >
              {t("Reset MFA")}
            </Menu.Item>
          )}
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
