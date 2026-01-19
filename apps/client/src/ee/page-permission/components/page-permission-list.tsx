import { Avatar, Group, ScrollArea, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { modals } from "@mantine/modals";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { IconGroupCircle } from "@/components/icons/icon-people-circle";
import {
  IPagePermissionMember,
  PagePermissionRole,
} from "@/ee/page-permission/types/page-permission.types";
import {
  useRemovePagePermissionMutation,
  useUpdatePagePermissionRoleMutation,
} from "@/ee/page-permission/queries/page-permission-query";
import { PagePermissionItem } from "./page-permission-item";
import classes from "./page-permission.module.css";

type PagePermissionListProps = {
  pageId: string;
  members: IPagePermissionMember[];
  canManage: boolean;
  onRemoveAll?: () => void;
};

export function PagePermissionList({
  pageId,
  members,
  canManage,
  onRemoveAll,
}: PagePermissionListProps) {
  const { t } = useTranslation();
  const currentUser = useAtomValue(userAtom);
  const updateRoleMutation = useUpdatePagePermissionRoleMutation();
  const removeMutation = useRemovePagePermissionMutation();

  const handleRoleChange = async (
    memberId: string,
    type: "user" | "group",
    newRole: string,
  ) => {
    await updateRoleMutation.mutateAsync({
      pageId,
      role: newRole as PagePermissionRole,
      ...(type === "user" ? { userId: memberId } : { groupId: memberId }),
    });
  };

  const handleRemove = (memberId: string, type: "user" | "group") => {
    modals.openConfirmModal({
      title: t("Remove access"),
      children: (
        <Text size="sm">
          {t("Are you sure you want to remove this member's access to the page?")}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await removeMutation.mutateAsync({
          pageId,
          ...(type === "user" ? { userIds: [memberId] } : { groupIds: [memberId] }),
        });
      },
    });
  };

  const handleRemoveAll = () => {
    modals.openConfirmModal({
      title: t("Remove all access"),
      children: (
        <Text size="sm">
          {t("Are you sure you want to remove all specific access? This will make the page open to everyone in the space.")}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove all"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => onRemoveAll?.(),
    });
  };

  const sortedMembers = [...members].sort((a, b) => {
    if (a.type === "user" && a.id === currentUser?.id) return -1;
    if (b.type === "user" && b.id === currentUser?.id) return 1;
    if (a.type === "group" && b.type === "user") return -1;
    if (a.type === "user" && b.type === "group") return 1;
    return 0;
  });

  const getSummaryText = () => {
    const names: string[] = [];
    let remaining = 0;

    for (const member of sortedMembers) {
      if (names.length < 2) {
        if (member.type === "user" && member.id === currentUser?.id) {
          names.push(t("You"));
        } else {
          names.push(member.name);
        }
      } else {
        remaining++;
      }
    }

    if (remaining > 0) {
      return `${names.join(", ")}, ${t("and {{count}} other", { count: remaining })}`;
    }
    return names.join(", ");
  };

  if (members.length === 0) {
    return null;
  }

  return (
    <>
      <div className={classes.specificAccessHeader}>
        <Text size="sm" fw={500}>
          {t("Specific access")}
        </Text>
        {canManage && members.length > 0 && (
          <>
            <Text size="sm" c="dimmed">
              •
            </Text>
            <Text
              className={classes.removeAllLink}
              onClick={handleRemoveAll}
            >
              {t("Remove all")}
            </Text>
          </>
        )}
      </div>

      <Group gap={0} mb="xs">
        <div className={classes.avatarStack}>
          {sortedMembers.slice(0, 3).map((member, index) => (
            <div
              key={member.id}
              className={classes.avatarStackItem}
              style={{ zIndex: sortedMembers.length - index }}
            >
              {member.type === "user" ? (
                <CustomAvatar
                  avatarUrl={member.avatarUrl}
                  name={member.name}
                  size={28}
                />
              ) : (
                <Avatar size={28} radius="xl">
                  <IconGroupCircle />
                </Avatar>
              )}
            </div>
          ))}
        </div>
        <Text size="sm" ml="xs">
          {getSummaryText()}
        </Text>
      </Group>

      <ScrollArea mah={250}>
        {sortedMembers.map((member) => (
          <PagePermissionItem
            key={`${member.type}-${member.id}`}
            member={member}
            onRoleChange={handleRoleChange}
            onRemove={handleRemove}
            disabled={!canManage}
          />
        ))}
      </ScrollArea>
    </>
  );
}
