import { Group, Text, Switch, MantineSize } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";

export default function EnforceSso() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Enforce SSO")}</Text>
        <Text size="sm" c="dimmed">
          {t(
            "Once enforced, members will not be able to login with email and password.",
          )}
        </Text>
      </div>

      <EnforceSsoToggle />
    </Group>
  );
}

interface EnforceSsoToggleProps {
  size?: MantineSize;
  label?: string;
}
export function EnforceSsoToggle({ size, label }: EnforceSsoToggleProps) {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(workspace?.enforceSso);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({ enforceSso: value });
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
      aria-label={t("Toggle sso enforcement")}
    />
  );
}
