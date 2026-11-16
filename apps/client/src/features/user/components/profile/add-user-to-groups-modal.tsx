import { useState } from "react";
import { Button, Group, Modal, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { MultiGroupSelect } from "@/features/group/components/multi-group-select";
import { addGroupMember } from "@/features/group/services/group-service";
import { IUserProfile } from "@/features/user/types/user.types";
import { getApiErrorMessage } from "@/lib/api-error";

type AddUserToGroupsModalProps = {
  profile: IUserProfile;
  excludeIds: string[];
  opened: boolean;
  onClose: () => void;
};

export function AddUserToGroupsModal({
  profile,
  excludeIds,
  opened,
  onClose,
}: AddUserToGroupsModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [groupIds, setGroupIds] = useState<string[]>([]);

  const handleClose = () => {
    setGroupIds([]);
    onClose();
  };

  const addToGroupsMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(
        ids.map((groupId) =>
          addGroupMember({ groupId, userIds: [profile.id] }),
        ),
      ),
    onSuccess: () => {
      notifications.show({ message: t("Added successfully") });
      handleClose();
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Something went wrong")),
        color: "red",
      });
    },
    onSettled: (_data, _error, ids) => {
      queryClient.invalidateQueries({ queryKey: ["user-groups", profile.id] });
      queryClient.invalidateQueries({ queryKey: ["user-spaces", profile.id] });
      ids.forEach((groupId) =>
        queryClient.invalidateQueries({ queryKey: ["groupMembers", groupId] }),
      );
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Add to groups")}
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <Group gap="sm" wrap="nowrap" mb="md">
        <CustomAvatar
          avatarUrl={profile.avatarUrl}
          name={profile.name}
          size={36}
          variant="filled"
        />
        <div style={{ minWidth: 0 }}>
          <Text fz="sm" fw={500} truncate>
            {profile.name}
          </Text>
          {profile.email && (
            <Text fz="xs" c="dimmed" truncate>
              {profile.email}
            </Text>
          )}
        </div>
      </Group>

      <MultiGroupSelect
        label={t("Groups")}
        excludeIds={excludeIds}
        onChange={setGroupIds}
      />

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={handleClose}>
          {t("Cancel")}
        </Button>
        <Button
          onClick={() => addToGroupsMutation.mutate(groupIds)}
          disabled={groupIds.length === 0}
          loading={addToGroupsMutation.isPending}
        >
          {t("Add")}
        </Button>
      </Group>
    </Modal>
  );
}
