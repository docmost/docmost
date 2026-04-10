import { Badge, Group, Text, Switch, Tooltip } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";

export default function EnableAiChat() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Group gap="xs" align="center">
          <Text size="md">{t("AI Chat")}</Text>
          <Badge color="gray" variant="light" size="sm" radius="sm">
            {t("Beta")}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {t(
            "Enable AI Chat to allow users to have multi-turn conversations with AI about your workspace content.",
          )}
        </Text>
      </div>

      <AiChatToggle />
    </Group>
  );
}

function AiChatToggle() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(workspace?.settings?.ai?.chat);
  const hasAccess = useHasFeature(Feature.AI);
  const upgradeLabel = useUpgradeLabel();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({ aiChat: value } as any);
      setChecked(value);
      setWorkspace(updatedWorkspace);
    } catch (err: any) {
      notifications.show({
        message: err?.response?.data?.message,
        color: "red",
      });
    }
  };

  return (
    <Tooltip label={upgradeLabel} disabled={hasAccess} refProp="rootRef">
      <Switch
        defaultChecked={checked}
        onChange={handleChange}
        disabled={!hasAccess}
        aria-label={t("Toggle AI Chat")}
      />
    </Tooltip>
  );
}
