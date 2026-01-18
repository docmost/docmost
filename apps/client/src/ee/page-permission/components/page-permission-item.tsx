import { Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { IconGroupCircle } from "@/components/icons/icon-people-circle";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { formatMemberCount } from "@/lib";
import {
  IPagePermissionMember,
  PagePermissionRole,
} from "@/ee/page-permission/types/page-permission.types";
import {
  pagePermissionRoleData,
  getPagePermissionRoleLabel,
} from "@/ee/page-permission/types/page-permission-role-data";
import classes from "./page-permission.module.css";

type PagePermissionItemProps = {
  member: IPagePermissionMember;
  onRoleChange: (memberId: string, type: "user" | "group", role: string) => void;
  onRemove: (memberId: string, type: "user" | "group") => void;
  disabled?: boolean;
};

export function PagePermissionItem({
  member,
  onRoleChange,
  onRemove,
  disabled,
}: PagePermissionItemProps) {
  const { t } = useTranslation();
  const currentUser = useAtomValue(userAtom);
  const isCurrentUser = member.type === "user" && member.id === currentUser?.id;
  const roleLabel = getPagePermissionRoleLabel(member.role);

  return (
    <div className={classes.permissionItem}>
      <div className={classes.permissionItemInfo}>
        {member.type === "user" && (
          <CustomAvatar avatarUrl={member.avatarUrl} name={member.name} />
        )}
        {member.type === "group" && <IconGroupCircle />}

        <div className={classes.permissionItemDetails}>
          <Group gap={4}>
            <Text fz="sm" fw={500} lineClamp={1}>
              {member.name}
            </Text>
            {isCurrentUser && (
              <Text fz="sm" c="dimmed">
                ({t("You")})
              </Text>
            )}
          </Group>
          <Text fz="xs" c="dimmed" lineClamp={1}>
            {member.type === "user" && member.email}
            {member.type === "group" && formatMemberCount(member.memberCount, t)}
          </Text>
        </div>
      </div>

      {isCurrentUser || disabled ? (
        <Text size="sm" c="dimmed">
          {t(roleLabel)}
        </Text>
      ) : (
        <Menu withArrow position="bottom-end">
          <Menu.Target>
            <UnstyledButton>
              <Group gap={4}>
                <Text size="sm">{t(roleLabel)}</Text>
                <IconChevronDown size={14} />
              </Group>
            </UnstyledButton>
          </Menu.Target>

          <Menu.Dropdown>
            {pagePermissionRoleData.map((role) => (
              <Menu.Item
                key={role.value}
                onClick={() => onRoleChange(member.id, member.type, role.value)}
                rightSection={
                  role.value === member.role ? <IconCheck size={16} /> : null
                }
              >
                <div>
                  <Text size="sm">{t(role.label)}</Text>
                  <Text size="xs" c="dimmed">
                    {t(role.description)}
                  </Text>
                </div>
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item
              color="red"
              onClick={() => onRemove(member.id, member.type)}
            >
              {t("Remove access")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
}
