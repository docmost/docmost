import { Group, Box, Button, TagsInput, Space, Select } from "@mantine/core";
import WorkspaceInviteSection from "@/features/workspace/components/members/components/workspace-invite-section.tsx";
import React from "react";

enum UserRole {
  OWNER = "Owner",
  ADMIN = "Admin",
  MEMBER = "Member",
}

export function WorkspaceInviteForm() {
  function handleSubmit(data) {
    console.log(data);
  }

  return (
    <>
      <Box maw="500" mx="auto">
        <WorkspaceInviteSection />

        <Space h="md" />

        <TagsInput
          description="Enter valid email addresses separated by comma or space"
          label="Invite from email"
          placeholder="enter valid emails addresses"
          variant="filled"
          splitChars={[",", " "]}
          maxDropdownHeight={200}
          maxTags={50}
        />

        <Space h="md" />

        <Select
          description="Select role to assign to all invited members"
          label="Select role"
          placeholder="Pick a role"
          variant="filled"
          data={Object.values(UserRole)}
          defaultValue={UserRole.MEMBER}
          allowDeselect={false}
          checkIconPosition="right"
        />

        <Group justify="center" mt="md">
          <Button>Send invitation</Button>
        </Group>
      </Box>
    </>
  );
}
