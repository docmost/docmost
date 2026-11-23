import {
  Group,
  Box,
  Button,
  Input,
  Select,
  TagsInput,
  Text,
  Textarea,
} from "@mantine/core";
import { useId } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import React, { useEffect, useRef, useState } from "react";
import { MultiGroupSelect } from "@/features/group/components/multi-group-select.tsx";
import { UserRole } from "@/lib/types.ts";
import { userRoleData } from "@/features/workspace/types/user-role-data.ts";
import { useCreateInvitationMutation } from "@/features/workspace/queries/workspace-query.ts";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const MESSAGE_MAX_LENGTH = 500;

interface Props {
  onClose: () => void;
}
export function WorkspaceInviteForm({ onClose }: Props) {
  const { t } = useTranslation();
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(UserRole.MEMBER);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const messageId = useId();
  const addMessageRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);
  const createInvitationMutation = useCreateInvitationMutation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!messageOpen && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      addMessageRef.current?.focus();
    }
  }, [messageOpen]);

  function removeMessage() {
    restoreFocusRef.current = true;
    setMessage("");
    setMessageOpen(false);
  }

  async function handleSubmit() {
    const validEmails = emails.filter((email) => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    });

    const trimmedMessage = message.trim();

    await createInvitationMutation.mutateAsync({
      role: role.toLowerCase(),
      emails: validEmails,
      groupIds: groupIds,
      ...(messageOpen && trimmedMessage ? { message: trimmedMessage } : {}),
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
          data-autofocus
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-form-type="other"
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
          onChange={(value) => setRole(value)}
        />

        <MultiGroupSelect
          mt="sm"
          description={t(
            "Invited members will be granted access to spaces the groups can access",
          )}
          label={t("Add to groups")}
          onChange={handleGroupSelect}
        />

        {messageOpen ? (
          <Box mt="sm">
            <Group justify="space-between" wrap="nowrap">
              <Input.Label htmlFor={messageId}>
                {t("Message")}{" "}
                <Text span c="dimmed" fw={400} inherit>
                  {t("(optional)")}
                </Text>
              </Input.Label>
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                aria-label={t("Remove message")}
                onClick={removeMessage}
              >
                {t("Remove")}
              </Button>
            </Group>
            <Textarea
              id={messageId}
              description={t(
                "Included in the invitation email. Links will be removed.",
              )}
              variant="filled"
              autosize
              minRows={4}
              maxRows={8}
              maxLength={MESSAGE_MAX_LENGTH}
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
              autoFocus
            />
            <Text size="xs" c="dimmed" ta="right" mt={4}>
              {message.length} / {MESSAGE_MAX_LENGTH}
            </Text>
          </Box>
        ) : (
          <Button
            ref={addMessageRef}
            type="button"
            variant="subtle"
            size="compact-sm"
            mt="sm"
            leftSection={<IconPlus size={14} />}
            onClick={() => setMessageOpen(true)}
          >
            {t("Add a custom message")}
          </Button>
        )}

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
