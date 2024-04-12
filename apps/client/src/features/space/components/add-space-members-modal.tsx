import { Button, Divider, Group, Modal, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import React, { useState } from "react";
import { useAddSpaceMemberMutation } from "@/features/space/queries/space-query.ts";
import { MultiMemberSelect } from "@/features/space/components/multi-member-select.tsx";
import { SpaceMemberRole } from "@/features/space/components/space-member-role.tsx";
import { SpaceRole } from "@/lib/types.ts";

interface AddSpaceMemberModalProps {
  spaceId: string;
}
export default function AddSpaceMembersModal({
  spaceId,
}: AddSpaceMemberModalProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [role, setRole] = useState<string>(SpaceRole.WRITER);
  const addSpaceMemberMutation = useAddSpaceMemberMutation();

  const handleMultiSelectChange = (value: string[]) => {
    setMemberIds(value);
  };

  const handleRoleSelection = (role: string) => {
    setRole(role);
  };

  const handleSubmit = async () => {
    // member can be a users or groups
    const userIds = memberIds
      .map((id) => (id.startsWith("user-") ? id.split("user-")[1] : null))
      .filter((id) => id !== null);

    const groupIds = memberIds
      .map((id) => (id.startsWith("group-") ? id.split("group-")[1] : null))
      .filter((id) => id !== null);

    const addSpaceMember = {
      spaceId: spaceId,
      userIds: userIds,
      groupIds: groupIds,
      role: role,
    };

    await addSpaceMemberMutation.mutateAsync(addSpaceMember);
    close();
  };

  return (
    <>
      <Button onClick={open}>Add space members</Button>
      <Modal opened={opened} onClose={close} title="Add space members">
        <Divider size="xs" mb="xs" />

        <Stack>
          <MultiMemberSelect onChange={handleMultiSelectChange} />
          <SpaceMemberRole
            onSelect={handleRoleSelection}
            defaultRole={role}
            label="Select role"
          />
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button onClick={handleSubmit} type="submit">
            Add
          </Button>
        </Group>
      </Modal>
    </>
  );
}
