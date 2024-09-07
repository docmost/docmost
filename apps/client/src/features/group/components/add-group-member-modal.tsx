import { Button, Divider, Group, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import React, { useState } from "react";
import { MultiUserSelect } from "@/features/group/components/multi-user-select.tsx";
import { useParams } from "react-router-dom";
import { useAddGroupMemberMutation } from "@/features/group/queries/group-query.ts";
import { useTranslation } from "react-i18next";

export default function AddGroupMemberModal() {
  const { t } = useTranslation();
  const { groupId } = useParams();
  const [opened, { open, close }] = useDisclosure(false);
  const [userIds, setUserIds] = useState<string[]>([]);
  const addGroupMemberMutation = useAddGroupMemberMutation();

  const handleMultiSelectChange = (value: string[]) => {
    setUserIds(value);
  };

  const handleSubmit = async () => {
    const addGroupMember = {
      groupId: groupId,
      userIds: userIds,
    };

    await addGroupMemberMutation.mutateAsync(addGroupMember);
    close();
  };

  return (
    <>
      <Button onClick={open}>{t("addGroupMembers")}</Button>

      <Modal opened={opened} onClose={close} title={t("addGroupMembers")}>
        <Divider size="xs" mb="xs" />

        <MultiUserSelect
          label={t("addGroupMembers")}
          onChange={handleMultiSelectChange}
        />

        <Group justify="flex-end" mt="md">
          <Button onClick={handleSubmit} type="submit">
            {t("add")}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
