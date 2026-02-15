import { Group, Text, Switch } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import { useIsCloudEE } from "@/hooks/use-is-cloud-ee.tsx";

export default function EnableGenerativeAi() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(workspace?.settings?.ai?.generative);
  const hasAccess = useIsCloudEE();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({ generativeAi: value });
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
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Generative AI (Ask AI)")}</Text>
        <Text size="sm" c="dimmed">
          {t(
            "Enable AI-powered content generation in the editor. Allows users to generate, improve, translate and transform text.",
          )}
        </Text>
      </div>

      <Switch
        defaultChecked={checked}
        onChange={handleChange}
        disabled={!hasAccess}
      />
    </Group>
  );
}
