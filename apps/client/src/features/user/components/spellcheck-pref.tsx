import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";
import { Group, MantineSize, Switch, Text } from "@mantine/core";
import { useAtom } from "jotai/index";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export default function SpellcheckPref() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Spellcheck")}</Text>
        <Text size="sm" c="dimmed">
          {t("Choose if spellcheck is enabled.")}
        </Text>
      </div>

      <SpellcheckToggle />
    </Group>
  );
}

interface SpellcheckToggleProps {
  size?: MantineSize;
  label?: string;
}

export function SpellcheckToggle({ size, label }: SpellcheckToggleProps) {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const [checked, setChecked] = useState(
    user.settings?.preferences?.spellcheck ?? true,
  );

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    const updatedUser = await updateUser({ spellcheck: value });
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
      aria-label={t("Toggle spellcheck")}
    />
  );
}