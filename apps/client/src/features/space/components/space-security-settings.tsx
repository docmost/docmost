import { Text, Divider } from "@mantine/core";
import React from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import SpacePublicSharingToggle from "@/ee/security/components/space-public-sharing-toggle.tsx";
import SpaceViewerCommentsToggle from "@/ee/security/components/space-viewer-comments-toggle.tsx";

type SpaceSecuritySettingsProps = {
  space: ISpace;
  readOnly?: boolean;
};

export default function SpaceSecuritySettings({
  space,
  readOnly,
}: SpaceSecuritySettingsProps) {
  const { t } = useTranslation();

  if (readOnly) return null;

  return (
    <div>
      <Text my="md" fw={600}>
        {t("Security")}
      </Text>

      <SpacePublicSharingToggle space={space} />

      <Divider my="lg" />

      <SpaceViewerCommentsToggle space={space} />
    </div>
  );
}
