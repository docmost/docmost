import { Group, Text, Switch, MantineSize, Title } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import { isCloud } from "@/lib/config.ts";
import useLicense from "@/ee/hooks/use-license.tsx";

export default function EnableAiSearch() {
  const { t } = useTranslation();

  return (
    <>
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Text size="md">{t("AI-powered search (AI Answers)")}</Text>
          <Text size="sm" c="dimmed">
            {t(
              "AI search uses vector embeddings to provide semantic search capabilities across your workspace content.",
            )}
          </Text>
        </div>

        <AiSearchToggle />
      </Group>
    </>
  );
}

interface AiSearchToggleProps {
  size?: MantineSize;
  label?: string;
}
export function AiSearchToggle({ size, label }: AiSearchToggleProps) {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(workspace?.settings?.ai?.search);
  const { hasLicenseKey } = useLicense();

  const hasAccess = isCloud() || (!isCloud() && hasLicenseKey);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({ aiSearch: value });
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
      disabled={!hasAccess}
      aria-label={t("Toggle AI search")}
    />
  );
}
