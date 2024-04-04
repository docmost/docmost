import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useEffect, useState } from "react";
import { Button, CopyButton, Group, Text, TextInput } from "@mantine/core";

export default function WorkspaceInviteSection() {
  const [currentUser] = useAtom(currentUserAtom);
  const [inviteLink, setInviteLink] = useState<string>("");

  useEffect(() => {
    setInviteLink(
      `${window.location.origin}/invite/${currentUser.workspace.inviteCode}`,
    );
  }, [currentUser.workspace.inviteCode]);

  return (
    <>
      <div>
        <Text fw={500} mb="sm">
          Invite link
        </Text>
        <Text c="dimmed" mb="sm">
          Anyone with this link can join this workspace.
        </Text>
      </div>

      <Group>
        <div style={{ flex: 1 }}>
          <TextInput variant="filled" value={inviteLink} readOnly />
        </div>
        <CopyButton value={inviteLink}>
          {({ copied, copy }) => (
            <Button color={copied ? "teal" : ""} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </CopyButton>
      </Group>
    </>
  );
}
