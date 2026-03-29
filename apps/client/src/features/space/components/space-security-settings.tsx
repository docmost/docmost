import { Text, Divider } from "@mantine/core";
import React from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";

type SpaceSecuritySettingsProps = {
  space: ISpace;
  readOnly?: boolean;
};

export default function SpaceSecuritySettings({
  space: _space,
  readOnly,
}: SpaceSecuritySettingsProps) {
  const { t } = useTranslation();

  if (readOnly) return null;

  return (
    <div>
      <Text my="md" fw={600}>
        {t("Security")}
      </Text>
      <Text c="dimmed">{t("Additional space security controls are not available.")}</Text>
    </div>
  );
}
