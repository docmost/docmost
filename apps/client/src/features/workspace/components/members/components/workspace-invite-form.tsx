import { Group, Box, Button, TagsInput, Select } from "@mantine/core";
import WorkspaceInviteSection from "@/features/workspace/components/members/components/workspace-invite-section.tsx";
import React, { useState } from "react";
import { MultiGroupSelect } from "@/features/group/components/multi-group-select.tsx";
import { UserRole } from "@/lib/types.ts";
import { userRoleData } from "@/features/workspace/types/user-role-data.ts";
import { useCreateInvitationMutation } from "@/features/workspace/queries/workspace-query.ts";
import { useNavigate } from "react-router-dom";

interface Props {
  onClose: () => void;
}
export function WorkspaceInviteForm({ onClose }: Props) {
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
          description="Enter valid email addresses separated by comma or space [max: 50]"
          label="Invite by email"
          placeholder="enter valid emails addresses"
          variant="filled"
          splitChars={[",", " "]}
          maxDropdownHeight={200}
          maxTags={50}
          onChange={setEmails}
        />

        <Select
          mt="sm"
          description="Select role to assign to all invited members"
          label="Select role"
          placeholder="Choose a role"
          variant="filled"
          data={userRoleData.filter((role) => role.value !== UserRole.OWNER)}
          defaultValue={UserRole.MEMBER}
          allowDeselect={false}
          checkIconPosition="right"
          onChange={setRole}
        />

        <MultiGroupSelect
          mt="sm"
          description="Invited members will be granted access to spaces the groups can access"
          label={"Add to groups"}
          onChange={handleGroupSelect}
        />

        <Group justify="flex-end" mt="md">
          <Button
            onClick={handleSubmit}
            loading={createInvitationMutation.isPending}
          >
            Send invitation
          </Button>
        </Group>
      </Box>
    </>
  );
}
