import React, { useState } from "react";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { EditSpaceForm } from "@/features/space/components/edit-space-form.tsx";
import { Button, Divider, Text, Title, Tooltip } from "@mantine/core";
import DeleteSpaceModal from "./delete-space-modal";
import ArchiveSpaceModal from "./archive-space-modal";
import { useDisclosure } from "@mantine/hooks";
import ExportModal from "@/components/common/export-modal.tsx";
import AvatarUploader from "@/components/common/avatar-uploader.tsx";
import {
  uploadSpaceIcon,
  removeSpaceIcon,
} from "@/features/attachments/services/attachment-service.ts";
import { useTranslation } from "react-i18next";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { queryClient } from "@/main.tsx";
import SpaceHomePageSelect from "@/features/space/components/space-home-page-select.tsx";
import {
  ResponsiveSettingsContent,
  ResponsiveSettingsControl,
  ResponsiveSettingsRow,
} from "@/components/ui/responsive-settings-row.tsx";
import { useExportDisabled } from "@/ee/security/hooks/use-export-disabled.ts";


interface SpaceDetailsProps {
  spaceId: string;
  readOnly?: boolean;
}
export default function SpaceDetails({ spaceId, readOnly }: SpaceDetailsProps) {
  const { t } = useTranslation();
  const { data: space, isLoading, refetch } = useSpaceQuery(spaceId);
  const { exportDisabled, exportDisabledLabel } = useExportDisabled(spaceId);
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [isIconUploading, setIsIconUploading] = useState(false);

  const handleIconUpload = async (file: File) => {
    setIsIconUploading(true);
    try {
      await uploadSpaceIcon(file, spaceId);
      await refetch();
      await queryClient.invalidateQueries({
        predicate: (item) => ["spaces"].includes(item.queryKey[0] as string),
      });
    } catch (err) {
      // skip
    } finally {
      setIsIconUploading(false);
    }
  };

  const handleIconRemove = async () => {
    setIsIconUploading(true);
    try {
      await removeSpaceIcon(spaceId);
      await refetch();
      await queryClient.invalidateQueries({
        predicate: (item) => ["spaces"].includes(item.queryKey[0] as string),
      });
    } catch (err) {
      // skip
    } finally {
      setIsIconUploading(false);
    }
  };

  return (
    <>
      {space && (
        <div>
          <Title order={3} my="md" size="h6" fw={600}>
            {t("Details")}
          </Title>

          <div style={{ marginBottom: "20px" }}>
            <Text size="sm" fw={500} mb="xs">
              {t("Icon")}
            </Text>
            <AvatarUploader
              currentImageUrl={space.logo}
              fallbackName={space.name}
              size={"60px"}
              variant="filled"
              type={AvatarIconType.SPACE_ICON}
              onUpload={handleIconUpload}
              onRemove={handleIconRemove}
              isLoading={isIconUploading}
              disabled={readOnly}
            />
          </div>

          <EditSpaceForm space={space} readOnly={readOnly} />

          <Divider my="lg" />

          <ResponsiveSettingsRow>
            <ResponsiveSettingsContent>
              <Text size="md">{t("Home page")}</Text>
              <Text size="sm" c="dimmed">
                {t("The page people see when they open this space.")}
              </Text>
            </ResponsiveSettingsContent>
            <ResponsiveSettingsControl>
              <SpaceHomePageSelect space={space} readOnly={readOnly} />
            </ResponsiveSettingsControl>
          </ResponsiveSettingsRow>

          {!readOnly && (
            <>
              <Divider my="lg" />

              <ResponsiveSettingsRow>
                <ResponsiveSettingsContent>
                  <Text size="md">{t("Export space")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("Export all pages and attachments in this space.")}
                  </Text>
                </ResponsiveSettingsContent>
                <ResponsiveSettingsControl>
                  <Tooltip
                    label={exportDisabledLabel}
                    disabled={!exportDisabled}
                    withArrow
                  >
                    <Button
                      onClick={openExportModal}
                      disabled={exportDisabled}
                      data-disabled={exportDisabled || undefined}
                    >
                      {t("Export")}
                    </Button>
                  </Tooltip>
                </ResponsiveSettingsControl>
              </ResponsiveSettingsRow>

              <Divider my="lg" />

              {!space.isPersonal && (
                <>
                  <ResponsiveSettingsRow>
                    <ResponsiveSettingsContent>
                      <Text size="md">
                        {space.archivedAt
                          ? t("Restore space")
                          : t("Archive space")}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {space.archivedAt
                          ? t("Make this space active again.")
                          : t(
                              "Archive a stale space to keep it out of lists and search.",
                            )}
                      </Text>
                    </ResponsiveSettingsContent>
                    <ResponsiveSettingsControl>
                      <ArchiveSpaceModal space={space} />
                    </ResponsiveSettingsControl>
                  </ResponsiveSettingsRow>

                  <Divider my="lg" />
                </>
              )}

              <ResponsiveSettingsRow>
                <ResponsiveSettingsContent>
                  <Text size="md">{t("Delete space")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("Delete this space with all its pages and data.")}
                  </Text>
                </ResponsiveSettingsContent>
                <ResponsiveSettingsControl>
                  <DeleteSpaceModal space={space} />
                </ResponsiveSettingsControl>
              </ResponsiveSettingsRow>

              <ExportModal
                type="space"
                id={space.id}
                open={exportOpened}
                onClose={closeExportModal}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
