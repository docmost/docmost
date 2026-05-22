import { userAtom } from "@/features/user/atoms/current-user-atom";
import { updateUser } from "@/features/user/services/user-service";
import { Badge, Group, Switch, Text } from "@mantine/core";
import { useAtom } from "jotai";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveSettingsRow,
  ResponsiveSettingsContent,
  ResponsiveSettingsControl,
} from "@/components/ui/responsive-settings-row";

export default function FixedToolbarPref() {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const [checked, setChecked] = useState(
    user.settings?.preferences?.editorToolbar ?? false,
  );

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    setChecked(value);
    try {
      const updatedUser = await updateUser({ editorToolbar: value });
      setUser(updatedUser);
    } catch {
      setChecked(!value);
    }
  };

  return (
    <ResponsiveSettingsRow>
      <ResponsiveSettingsContent>
        <Group gap="xs">
          <Text size="md">{t("Fixed editor toolbar")}</Text>
          <Badge size="xs" color="gray" variant="light">
            {t("Experimental")}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {t(
            "Show a formatting toolbar above the editor with quick access to common actions.",
          )}
        </Text>
      </ResponsiveSettingsContent>

      <ResponsiveSettingsControl>
        <Switch
          labelPosition="left"
          defaultChecked={checked}
          onChange={handleChange}
          aria-label={t("Toggle fixed editor toolbar")}
        />
      </ResponsiveSettingsControl>
    </ResponsiveSettingsRow>
  );
}
