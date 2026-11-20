import { Group, Text, Select } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import { getApiErrorMessage } from "@/lib/api-error.ts";
import { LANGUAGE_OPTIONS } from "@/lib/constants.ts";
import useUserRole from "@/hooks/use-user-role.tsx";

export default function WorkspaceDefaultLanguage() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Default language")}</Text>
        <Text size="sm" c="dimmed">
          {t("The workspace language and the default for new members.")}
        </Text>
      </div>

      <DefaultLanguageSelect />
    </Group>
  );
}

function DefaultLanguageSelect() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [value, setValue] = useState<string>(
    workspace?.settings?.defaultLocale ?? "en-US",
  );

  const handleChange = async (newValue: string) => {
    const prevValue = value;
    setValue(newValue);
    try {
      const updatedWorkspace = await updateWorkspace({
        defaultLocale: newValue,
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

  return (
    <Select
      aria-label={t("Default language")}
      data={LANGUAGE_OPTIONS}
      value={value}
      onChange={handleChange}
      allowDeselect={false}
      checkIconPosition="right"
      disabled={!isAdmin}
      w={220}
      style={{ flexShrink: 0 }}
    />
  );
}
