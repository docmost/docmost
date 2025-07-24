import React, { useState } from "react";
import { Group, Text, Button } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { getMfaStatus } from "@/ee/mfa";
import { MfaSetupModal } from "@/ee/mfa";
import { MfaDisableModal } from "@/ee/mfa";
import { MfaBackupCodesModal } from "@/ee/mfa";

export function MfaSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [backupCodesModalOpen, setBackupCodesModalOpen] = useState(false);

  const { data: mfaStatus, isLoading } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: getMfaStatus,
  });

  if (isLoading) {
    return null;
  }

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
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text size="md">{t("2-step verification")}</Text>
          <Text size="sm" c="dimmed">
            {!isMfaEnabled
              ? t(
                  "Protect your account with an additional verification layer when signing in.",
                )
              : t("Two-factor authentication is active on your account.")}
          </Text>
        </div>

        {!isMfaEnabled ? (
          <Button
            variant="default"
            onClick={() => setSetupModalOpen(true)}
            style={{ whiteSpace: "nowrap" }}
          >
            {t("Add 2FA method")}
          </Button>
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
      </Group>

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
