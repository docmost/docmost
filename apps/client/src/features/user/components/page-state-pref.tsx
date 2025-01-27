import { Group, Text, Switch, MantineSize, SegmentedControl } from "@mantine/core";
import { useAtom } from "jotai/index";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageState } from "../types/user.types";

export default function PageStatePref() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Default page state")}</Text>
        <Text size="sm" c="dimmed">
          {t("Choose your preferred page state.")}
        </Text>
      </div>

      <PageStateSegmentedControl />
    </Group>
  );
}

interface PageStateSegmentedControlProps {
  size?: MantineSize;
}

export function PageStateSegmentedControl({ size }: PageStateSegmentedControlProps) {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const [value, setValue] = useState(
    user.settings?.preferences?.pageState || PageState.Edit,
  );

  const handleChange = async (value: string) => {
    const updatedUser = await updateUser({ pageState: value });
    console.log(updatedUser)
    setValue(value);
    setUser(updatedUser);
  };

  return (
    <SegmentedControl
      size={size}
      value={value}
      onChange={handleChange}
      data={[
        { label: t('Edit'), value: PageState.Edit },
        { label: t('Reading'), value: PageState.Reading },
      ]}
    />
  )
}