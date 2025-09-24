import React, { useState } from "react";
import { Group, Text, Button, Tooltip } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { getMfaStatus } from "@/ee/mfa";
import { MfaSetupModal } from "@/ee/mfa";
import { MfaDisableModal } from "@/ee/mfa";
import { MfaBackupCodesModal } from "@/ee/mfa";
import { isCloud } from "@/lib/config.ts";
import useLicense from "@/ee/hooks/use-license.tsx";
import { ResponsiveSettingsRow, ResponsiveSettingsContent, ResponsiveSettingsControl } from "@/components/ui/responsive-settings-row";

export function MfaSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [backupCodesModalOpen, setBackupCodesModalOpen] = useState(false);
  const { hasLicenseKey } = useLicense();

  const { data: mfaStatus, isLoading } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: getMfaStatus,
  });

  if (isLoading || !mfaStatus) {
    return null;
  }

  const canUseMfa = isCloud() || hasLicenseKey;

  // Check if MFA is truly enabled
  const isMfaEnabled = mfaStatus?.isEnabled === true;

  const handleSetupComplete = () => {
    setSetupModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    notifications.show({
      title: t("Success"),
      message: t("Two-factor authentication has been enabled"),
    });
  };

  const handleDisableComplete = () => {
    setDisableModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    notifications.show({
      title: t("Success"),
      message: t("Two-factor authentication has been disabled"),
      color: "blue",
    });
  };

  return (
    <>
      <ResponsiveSettingsRow>
        <ResponsiveSettingsContent>
          <Text size="md">{t("2-step verification")}</Text>
          <Text size="sm" c="dimmed">
            {!isMfaEnabled
              ? t(
                  "Protect your account with an additional verification layer when signing in.",
                )
              : t("Two-factor authentication is active on your account.")}
          </Text>
        </ResponsiveSettingsContent>

        <ResponsiveSettingsControl>
          {!isMfaEnabled ? (
            <Tooltip
              label={t("Available in enterprise edition")}
              disabled={canUseMfa}
            >
              <Button
                disabled={!canUseMfa}
                variant="default"
                onClick={() => setSetupModalOpen(true)}
                style={{ whiteSpace: "nowrap" }}
              >
                {t("Add 2FA method")}
              </Button>
            </Tooltip>
          ) : (
            <Group gap="sm" wrap="nowrap">
              <Button
                variant="default"
                size="sm"
                onClick={() => setBackupCodesModalOpen(true)}
                style={{ whiteSpace: "nowrap" }}
              >
                {t("Backup codes")} ({mfaStatus?.backupCodesCount || 0})
              </Button>
              <Button
                variant="default"
                size="sm"
                color="red"
                onClick={() => setDisableModalOpen(true)}
                style={{ whiteSpace: "nowrap" }}
              >
                {t("Disable")}
              </Button>
            </Group>
          )}
        </ResponsiveSettingsControl>
      </ResponsiveSettingsRow>

      <MfaSetupModal
        opened={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        onComplete={handleSetupComplete}
      />

      <MfaDisableModal
        opened={disableModalOpen}
        onClose={() => setDisableModalOpen(false)}
        onComplete={handleDisableComplete}
      />

      <MfaBackupCodesModal
        opened={backupCodesModalOpen}
        onClose={() => setBackupCodesModalOpen(false)}
      />
    </>
  );
}
