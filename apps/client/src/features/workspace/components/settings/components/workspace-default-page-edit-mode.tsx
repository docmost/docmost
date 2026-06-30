import { Group, Text, SegmentedControl } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import { getApiErrorMessage } from "@/lib/api-error.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";

export default function WorkspaceDefaultPageEditMode() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Default page edit mode")}</Text>
        <Text size="sm" c="dimmed">
          {t(
            "Choose the page edit mode new members start with. Existing members are not affected.",
          )}
        </Text>
      </div>

      <DefaultPageEditModeControl />
    </Group>
  );
}

function DefaultPageEditModeControl() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const defaultPageEditMode =
    workspace?.settings?.defaultPageEditMode ?? PageEditMode.Edit;
  const [value, setValue] = useState<string>(defaultPageEditMode);

  const handleChange = async (newValue: string) => {
    const prevValue = value;
    setValue(newValue);
    try {
      const updatedWorkspace = await updateWorkspace({
        defaultPageEditMode: newValue,
      });
      setWorkspace(updatedWorkspace);
    } catch (err) {
      setValue(prevValue);
      notifications.show({
        message: getApiErrorMessage(err, t("Failed to update setting")),
        color: "red",
      });
    }
  };

  useEffect(() => {
    if (defaultPageEditMode !== value) {
      setValue(defaultPageEditMode);
    }
  }, [defaultPageEditMode, value]);

  return (
    <SegmentedControl
      aria-label={t("Default page edit mode")}
      value={value}
      onChange={handleChange}
      data={[
        { label: t("Edit"), value: PageEditMode.Edit },
        { label: t("Read"), value: PageEditMode.Read },
      ]}
    />
  );
}
