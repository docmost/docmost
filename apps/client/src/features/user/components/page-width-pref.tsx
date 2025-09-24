import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";
import { MantineSize, Switch, Text } from "@mantine/core";
import { useAtom } from "jotai/index";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveSettingsRow, ResponsiveSettingsContent, ResponsiveSettingsControl } from "@/components/ui/responsive-settings-row";

export default function PageWidthPref() {
  const { t } = useTranslation();

  return (
    <ResponsiveSettingsRow>
      <ResponsiveSettingsContent>
        <Text size="md">{t("Full page width")}</Text>
        <Text size="sm" c="dimmed">
          {t("Choose your preferred page width.")}
        </Text>
      </ResponsiveSettingsContent>

      <ResponsiveSettingsControl>
        <PageWidthToggle />
      </ResponsiveSettingsControl>
    </ResponsiveSettingsRow>
  );
}

interface PageWidthToggleProps {
  size?: MantineSize;
  label?: string;
}

export function PageWidthToggle({ size, label }: PageWidthToggleProps) {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const [checked, setChecked] = useState(
    user.settings?.preferences?.fullPageWidth,
  );

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    const updatedUser = await updateUser({ fullPageWidth: value });
    setChecked(value);
    setUser(updatedUser);
  };

  return (
    <Switch
      size={size}
      label={label}
      labelPosition="left"
      defaultChecked={checked}
      onChange={handleChange}
      aria-label={t("Toggle full page width")}
    />
  );
}