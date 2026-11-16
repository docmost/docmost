import { Menu, ActionIcon } from "@mantine/core";
import React from "react";
import { IconDots, IconTrash, IconUserOff, IconUserCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useMemberActions } from "@/features/workspace/hooks/use-member-actions.tsx";

interface Props {
  userId: string;
  name: string;
  deactivatedAt: Date | null;
}
export default function MemberActionMenu({
  userId,
  name,
  deactivatedAt,
}: Props) {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();

  const isDeactivated = !!deactivatedAt;

  const { openDeactivateModal, openDeleteModal } = useMemberActions({
    userId,
    isDeactivated,
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
          <ActionIcon
            variant="subtle"
            c="gray"
            aria-label={t("Member actions for {{name}}", { name })}
          >
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
            onClick={openDeleteModal}
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
