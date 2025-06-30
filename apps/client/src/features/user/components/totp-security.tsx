import { Button, Group, Text, Modal, TextInput, Alert, Stack, Code, Divider } from "@mantine/core";
import * as z from "zod";
import { useState, useEffect } from "react";
import { useDisclosure } from "@mantine/hooks";
import * as React from "react";
import { useForm, zodResolver } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { IconShield, IconAlertTriangle } from "@tabler/icons-react";
import { setupTotp, enableTotp, disableTotp, regenerateBackupCodes } from "@/features/auth/services/auth-service";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useQueryClient } from "@tanstack/react-query";

interface TotpSetupData {
  qrCodeDataUrl: string;
  secret: string;
}

export default function TotpSecurity() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const queryClient = useQueryClient();
  const [setupOpened, { open: openSetup, close: closeSetup }] = useDisclosure(false);
  const [disableOpened, { open: openDisable, close: closeDisable }] = useDisclosure(false);
  const [backupCodesOpened, { open: openBackupCodes, close: closeBackupCodes }] = useDisclosure(false);
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const totpEnabled = currentUser?.user?.totpEnabled || false;

  const refreshUserData = async () => {
    await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
  };

  const handleSetupTotp = async () => {
    setIsLoading(true);
    try {
      const data = await setupTotp();
      setSetupData(data);
      openSetup();
    } catch (err) {
      notifications.show({
        message: `Error: ${err.response?.data?.message || 'Failed to setup TOTP'}`,
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    setIsLoading(true);
    try {
      const data = await regenerateBackupCodes();
      setBackupCodes(data.backupCodes);
      openBackupCodes();
    } catch (err) {
      notifications.show({
        message: `Error: ${err.response?.data?.message || 'Failed to regenerate backup codes'}`,
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Two-Factor Authentication (TOTP)")}</Text>
        <Text size="sm" c="dimmed">
          {totpEnabled 
            ? t("TOTP is enabled. Your account is secured with two-factor authentication.")
            : t("Add an extra layer of security to your account with TOTP.")
          }
        </Text>
      </div>

      <div>
        {totpEnabled ? (
          <>
            <Button onClick={handleRegenerateBackupCodes} variant="default" loading={isLoading}>
              {t("Regenerate backup codes")}
            </Button>
            <Button onClick={openDisable} color="red" variant="light">
              {t("Disable TOTP")}
            </Button>
          </>
        ) : (
          <Button onClick={handleSetupTotp} loading={isLoading}>
            {t("Enable TOTP")}
          </Button>
        )}
      </div>

      {/* Setup TOTP Modal */}
      <SetupTotpModal 
        opened={setupOpened} 
        onClose={closeSetup} 
        setupData={setupData}
        onSuccess={async (codes) => {
          setBackupCodes(codes);
          closeSetup();
          openBackupCodes();
          await refreshUserData();
        }}
      />

      {/* Disable TOTP Modal */}
      <DisableTotpModal 
        opened={disableOpened} 
        onClose={closeDisable} 
        onSuccess={async () => {
          closeDisable();
          await refreshUserData();
        }}
      />

      {/* Backup Codes Modal */}
      <BackupCodesModal 
        opened={backupCodesOpened} 
        onClose={closeBackupCodes} 
        backupCodes={backupCodes}
      />
    </Group>
  );
}

const setupFormSchema = z.object({
  token: z.string().min(6).max(6),
});

type SetupFormValues = z.infer<typeof setupFormSchema>;

interface SetupTotpModalProps {
  opened: boolean;
  onClose: () => void;
  setupData: TotpSetupData | null;
  onSuccess: (backupCodes: string[]) => Promise<void>;
}

function SetupTotpModal({ opened, onClose, setupData, onSuccess }: SetupTotpModalProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SetupFormValues>({
    validate: zodResolver(setupFormSchema),
    initialValues: {
      token: "",
    },
  });

  const handleSubmit = async (values: SetupFormValues) => {
    if (!setupData) return;
    
    setIsLoading(true);
    try {
      const result = await enableTotp({
        token: values.token,
        secret: setupData.secret,
      });
      
      notifications.show({
        message: t("TOTP enabled successfully"),
      });
      
      await onSuccess(result.backupCodes);
      form.reset();
    } catch (err) {
      notifications.show({
        message: `Error: ${err.response?.data?.message || 'Failed to enable TOTP'}`,
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Enable Two-Factor Authentication")}
      centered
      size="md"
    >
      {setupData && (
        <Stack>
          <Alert color="blue" icon={<IconShield size={16} />}>
            {t("Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)")}
          </Alert>

          <div style={{ textAlign: 'center' }}>
            <img src={setupData.qrCodeDataUrl} alt="QR Code" style={{ maxWidth: '200px' }} />
          </div>

          <Text size="sm" c="dimmed" ta="center">
            {t("Can't scan? Enter this code manually:")}
          </Text>
          <Code block ta="center" fz="xs">
            {setupData.secret}
          </Code>

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <TextInput
              label={t("Enter the 6-digit code from your app")}
              placeholder="123456"
              variant="filled"
              maxLength={6}
              {...form.getInputProps("token")}
            />

            <Group justify="flex-end" mt="md">
              <Button type="button" variant="default" onClick={handleClose}>
                {t("Cancel")}
              </Button>
              <Button type="submit" loading={isLoading}>
                {t("Enable TOTP")}
              </Button>
            </Group>
          </form>
        </Stack>
      )}
    </Modal>
  );
}

const disableFormSchema = z.object({
  token: z.string().min(6).max(8), // Allow both TOTP tokens (6) and backup codes (8)
});

type DisableFormValues = z.infer<typeof disableFormSchema>;

interface DisableTotpModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

function DisableTotpModal({ opened, onClose, onSuccess }: DisableTotpModalProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<DisableFormValues>({
    validate: zodResolver(disableFormSchema),
    initialValues: {
      token: "",
    },
  });

  const handleSubmit = async (values: DisableFormValues) => {
    setIsLoading(true);
    try {
      await disableTotp({ token: values.token });
      
      notifications.show({
        message: t("TOTP disabled successfully"),
      });
      
      await onSuccess();
      form.reset();
    } catch (err) {
      notifications.show({
        message: `Error: ${err.response?.data?.message || 'Failed to disable TOTP'}`,
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Disable Two-Factor Authentication")}
      centered
    >
      <Stack>
        <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
          {t("Are you sure you want to disable TOTP? This will make your account less secure.")}
        </Alert>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label={t("Enter your current TOTP code or backup code to confirm")}
            placeholder="123456 or 8-digit backup code"
            variant="filled"
            maxLength={8}
            {...form.getInputProps("token")}
          />

          <Group justify="flex-end" mt="md">
            <Button type="button" variant="default" onClick={handleClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" color="red" loading={isLoading}>
              {t("Disable TOTP")}
            </Button>
          </Group>
        </form>
      </Stack>
    </Modal>
  );
}

interface BackupCodesModalProps {
  opened: boolean;
  onClose: () => void;
  backupCodes: string[];
}

function BackupCodesModal({ opened, onClose, backupCodes }: BackupCodesModalProps) {
  const { t } = useTranslation();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    notifications.show({
      message: t("Backup codes copied to clipboard"),
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Backup Codes")}
      centered
    >
      <Stack>
        <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
          {t("Save these backup codes in a safe place. Each code can only be used once.")}
        </Alert>

        <div>
          {backupCodes.map((code, index) => (
            <Code key={index} block mb="xs">
              {code}
            </Code>
          ))}
        </div>

        <Group justify="space-between">
          <Button variant="default" onClick={copyToClipboard}>
            {t("Copy to clipboard")}
          </Button>
          <Button onClick={onClose}>
            {t("I've saved them")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
