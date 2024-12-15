import { Group, Box, Button, TagsInput, Select } from "@mantine/core";
import React, { useState } from "react";
import { MultiGroupSelect } from "@/features/group/components/multi-group-select.tsx";
import { UserRole } from "@/lib/types.ts";
import { userRoleData } from "@/features/workspace/types/user-role-data.ts";
import { useCreateInvitationMutation } from "@/features/workspace/queries/workspace-query.ts";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface Props {
  onClose: () => void;
}
export function WorkspaceInviteForm({ onClose }: Props) {
  const { t } = useTranslation();
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(UserRole.MEMBER);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const createInvitationMutation = useCreateInvitationMutation();
  const navigate = useNavigate();

  async function handleSubmit() {
    const validEmails = emails.filter((email) => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    });

    await createInvitationMutation.mutateAsync({
      role: role.toLowerCase(),
      emails: validEmails,
      groupIds: groupIds,
    });

    onClose();

    navigate("?tab=invites");
  }

  const handleGroupSelect = (value: string[]) => {
    setGroupIds(value);
  };

  return (
    <>
      <Box maw="500" mx="auto">
        {/*<WorkspaceInviteSection /> */}

        <TagsInput
          mt="sm"
          description={t(
            "Enter valid email addresses separated by comma or space max_50",
          )}
          label={t("Invite by email")}
          placeholder={t("enter valid emails addresses")}
          variant="filled"
          splitChars={[",", " "]}
          maxDropdownHeight={200}
          maxTags={50}
          onChange={setEmails}
        />

        <Select
          mt="sm"
          description={t("Select role to assign to all invited members")}
          label={t("Select role")}
          placeholder={t("Choose a role")}
          variant="filled"
          data={userRoleData
            .filter((role) => role.value !== UserRole.OWNER)
            .map((role) => ({
              ...role,
              label: t(`${role.label}`),
              description: t(`${role.description}`),
            }))}
          defaultValue={UserRole.MEMBER}
          allowDeselect={false}
          checkIconPosition="right"
          onChange={setRole}
        />

        <MultiGroupSelect
          mt="sm"
          description={t(
            "Invited members will be granted access to spaces the groups can access",
          )}
          label={t("Add to groups")}
          onChange={handleGroupSelect}
        />

        <Group justify="flex-end" mt="md">
          <Button
            onClick={handleSubmit}
            loading={createInvitationMutation.isPending}
          >
            {t("Send invitation")}
          </Button>
        </Group>
      </Box>
    </>
  );
}
