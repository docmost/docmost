import { Group, Text, Switch, Tooltip } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label.ts";

export default function PersonalSpacesSetting() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Allow personal spaces")}</Text>
        <Text size="sm" c="dimmed">
          {t("Members can create their own personal space.")}
        </Text>
      </div>

      <PersonalSpacesToggle />
    </Group>
  );
}

function PersonalSpacesToggle() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(
    workspace?.settings?.spaces?.allowPersonal === true,
  );
  const hasPersonalSpaces = useHasFeature(Feature.PERSONAL_SPACES);
  const upgradeLabel = useUpgradeLabel();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({
        allowPersonalSpaces: value,
      });
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
    <Tooltip label={upgradeLabel} disabled={hasPersonalSpaces} refProp="rootRef">
      <Switch
        checked={checked}
        onChange={handleChange}
        disabled={!hasPersonalSpaces}
        aria-label={t("Toggle allow personal spaces")}
      />
    </Tooltip>
  );
}
