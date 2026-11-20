import { useId } from "react";
import { Button, Menu } from "@mantine/core";
import {
  IconCheck,
  IconChevronDown,
  IconTrash,
  IconUserCheck,
  IconUserOff,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { RadioMenuItem } from "@/components/ui/radio-menu-item";
import { IUserProfile } from "@/features/user/types/user.types";
import { useMemberActions } from "@/features/workspace/hooks/use-member-actions";
import { useChangeMemberRoleMutation } from "@/features/workspace/queries/workspace-query";
import { userRoleData } from "@/features/workspace/types/user-role-data";
import useUserRole from "@/hooks/use-user-role";
import APP_ROUTE from "@/lib/app-route";
import { UserRole } from "@/lib/types";

type UserProfileManageMenuProps = {
  profile: IUserProfile;
};

export function UserProfileManageMenu({ profile }: UserProfileManageMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const roleLabelId = useId();
  const { isOwner } = useUserRole();
  const changeMemberRoleMutation = useChangeMemberRoleMutation();
  const isDeactivated = !!profile.deactivatedAt;
  // admins cannot act on owners or assign the owner role, same as the server
  const canManage = isOwner || profile.role !== UserRole.OWNER;

  const refreshProfile = () =>
    queryClient.invalidateQueries({ queryKey: ["user-profile", profile.id] });

  const { openDeactivateModal, openDeleteModal } = useMemberActions({
    userId: profile.id,
    isDeactivated,
    onStatusChange: refreshProfile,
    onDelete: () => {
      refreshProfile();
      navigate(APP_ROUTE.SETTINGS.WORKSPACE.MEMBERS);
    },
  });

  const handleRoleChange = (role: string) => {
    if (role === profile.role) return;
    changeMemberRoleMutation.mutate(
      { userId: profile.id, role },
      { onSuccess: refreshProfile },
    );
  };

  return (
    <Menu shadow="md" position="bottom-end" width={220}>
      <Menu.Target>
        <Button
          variant="default"
          rightSection={<IconChevronDown size={16} aria-hidden />}
        >
          {t("Manage user")}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label id={roleLabelId}>{t("Role")}</Menu.Label>
        <div role="group" aria-labelledby={roleLabelId}>
          {userRoleData.map((role) => {
            const checked = profile.role === role.value;
            return (
              <Menu.Item
                key={role.value}
                component={RadioMenuItem}
                aria-checked={checked}
                disabled={
                  !canManage || (!isOwner && role.value === UserRole.OWNER)
                }
                onClick={() => handleRoleChange(role.value)}
                rightSection={checked && <IconCheck size={20} aria-hidden />}
              >
                {t(role.label)}
              </Menu.Item>
            );
          })}
        </div>

        <Menu.Divider />

        <Menu.Item
          onClick={openDeactivateModal}
          leftSection={
            isDeactivated ? (
              <IconUserCheck size={16} />
            ) : (
              <IconUserOff size={16} />
            )
          }
          disabled={!canManage}
        >
          {isDeactivated ? t("Activate member") : t("Deactivate member")}
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          c="red"
          onClick={openDeleteModal}
          leftSection={<IconTrash size={16} />}
          disabled={!canManage}
        >
          {t("Delete member")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
