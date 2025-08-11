import { Group, Text, Switch, MantineSize, Title } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";

export default function EnforceMfa() {
  const { t } = useTranslation();

  return (
    <>
      <Title order={4} my="sm">
        MFA
      </Title>
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Text size="md">{t("Enforce two-factor authentication")}</Text>
          <Text size="sm" c="dimmed">
            {t(
              "Once enforced, all members must enable two-factor authentication to access the workspace.",
            )}
          </Text>
        </div>

        <EnforceMfaToggle />
      </Group>
    </>
  );
}

interface EnforceMfaToggleProps {
  size?: MantineSize;
  label?: string;
}
export function EnforceMfaToggle({ size, label }: EnforceMfaToggleProps) {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(workspace?.enforceMfa);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({ enforceMfa: value });
      setChecked(value);
      setWorkspace(updatedWorkspace);
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message,
        color: "red",
      });
    }
  };

  return (
    <Switch
      size={size}
      label={label}
      labelPosition="left"
      defaultChecked={checked}
      onChange={handleChange}
      aria-label={t("Toggle MFA enforcement")}
    />
  );
}
