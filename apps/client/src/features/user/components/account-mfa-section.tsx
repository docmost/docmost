import React from "react";
import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

export function AccountMfaSection() {
  const { t } = useTranslation();
  return <Text c="dimmed">{t("Two-factor authentication is not available.")}</Text>;
}
