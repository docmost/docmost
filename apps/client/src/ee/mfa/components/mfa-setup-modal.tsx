import React, { useState } from "react";
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Stepper,
  Center,
  Image,
  PinInput,
  Alert,
  List,
  CopyButton,
  ActionIcon,
  Tooltip,
  Paper,
  Code,
  Loader,
  Collapse,
  UnstyledButton,
} from "@mantine/core";
import {
  IconQrcode,
  IconShieldCheck,
  IconKey,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconPrinter,
} from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { setupMfa, enableMfa } from "@/ee/mfa";
import { zodResolver } from "mantine-form-zod-resolver";
import { z } from "zod";

interface MfaSetupModalProps {
  opened: boolean;
  onClose?: () => void;
  onComplete: () => void;
  isRequired?: boolean;
}

interface SetupData {
  secret: string;
  qrCode: string;
  manualKey: string;
}

const formSchema = z.object({
  verificationCode: z
    .string()
    .length(6, { message: "Please enter a 6-digit code" }),
});

export function MfaSetupModal({
  opened,
  onClose,
  onComplete,
  isRequired = false,
}: MfaSetupModalProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);

  const form = useForm({
    validate: zodResolver(formSchema),
    initialValues: {
      verificationCode: "",
    },
  });

  const setupMutation = useMutation({
    mutationFn: () => setupMfa({ method: "totp" }),
    onSuccess: (data) => {
      setSetupData(data);
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error"),
        message: error.response?.data?.message || t("Failed to setup MFA"),
        color: "red",
      });
    },
  });

  // Generate QR code when modal opens
  React.useEffect(() => {
    if (opened && !setupData && !setupMutation.isPending) {
      setupMutation.mutate();
    }
  }, [opened]);

  const enableMutation = useMutation({
    mutationFn: (verificationCode: string) =>
      enableMfa({
        secret: setupData!.secret,
        verificationCode,
      }),
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setActive(1); // Move to backup codes step
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error"),
        message:
          error.response?.data?.message || t("Invalid verification code"),
        color: "red",
      });
      form.setFieldValue("verificationCode", "");
    },
  });

  const handleClose = () => {
    if (active === 1 && backupCodes.length > 0) {
      onComplete();
    }
    onClose();
    // Reset state
    setTimeout(() => {
      setActive(0);
      setSetupData(null);
      setBackupCodes([]);
      setManualEntryOpen(false);
      form.reset();
    }, 200);
  };

  const handleVerify = async (values: { verificationCode: string }) => {
    await enableMutation.mutateAsync(values.verificationCode);
  };

  const handlePrintBackupCodes = () => {
    window.print();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Set up two-factor authentication")}
      size="md"
    >
      <Stepper active={active} size="sm">
        <Stepper.Step
          label={t("Setup & Verify")}
          description={t("Add to authenticator")}
          icon={<IconQrcode size={18} />}
        >
          <form onSubmit={form.onSubmit(handleVerify)}>
            <Stack gap="md" mt="xl">
              {setupMutation.isPending ? (
                <Center py="xl">
                  <Loader size="lg" />
                </Center>
              ) : setupData ? (
                <>
                  <Text size="sm">
                    {t("1. Scan this QR code with your authenticator app")}
                  </Text>

                  <Center>
                    <Paper p="md" withBorder>
                      <Image
                        src={setupData.qrCode}
                        alt="MFA QR Code"
                        width={200}
                        height={200}
                      />
                    </Paper>
                  </Center>

                  <UnstyledButton
                    onClick={() => setManualEntryOpen(!manualEntryOpen)}
                  >
                    <Group gap="xs">
                      {manualEntryOpen ? (
                        <IconChevronDown size={16} />
                      ) : (
                        <IconChevronRight size={16} />
                      )}
                      <Text size="sm" c="dimmed">
                        {t("Can't scan the code?")}
                      </Text>
                    </Group>
                  </UnstyledButton>

                  <Collapse in={manualEntryOpen}>
                    <Alert
                      icon={<IconAlertCircle size={20} />}
                      color="gray"
                      variant="light"
                    >
                      <Text size="sm" mb="sm">
                        {t(
                          "Enter this code manually in your authenticator app:",
                        )}
                      </Text>
                      <Group gap="xs">
                        <Code block>{setupData.manualKey}</Code>
                        <CopyButton value={setupData.manualKey}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? t("Copied") : t("Copy")}>
                              <ActionIcon
                                color={copied ? "green" : "gray"}
                                onClick={copy}
                              >
                                {copied ? (
                                  <IconCheck size={16} />
                                ) : (
                                  <IconCopy size={16} />
                                )}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Alert>
                  </Collapse>

                  <Text size="sm" mt="md">
                    {t("2. Enter the 6-digit code from your authenticator")}
                  </Text>

                  <Stack align="center">
                    <PinInput
                      length={6}
                      type="number"
                      autoFocus
                      data-autofocus
                      oneTimeCode
                      {...form.getInputProps("verificationCode")}
                      styles={{
                        input: {
                          fontSize: "1.2rem",
                          textAlign: "center",
                        },
                      }}
                    />
                    {form.errors.verificationCode && (
                      <Text c="red" size="sm">
                        {form.errors.verificationCode}
                      </Text>
                    )}
                  </Stack>

                  <Button
                    type="submit"
                    fullWidth
                    loading={enableMutation.isPending}
                    leftSection={<IconShieldCheck size={18} />}
                  >
                    {t("Verify and enable")}
                  </Button>
                </>
              ) : (
                <Center py="xl">
                  <Text size="sm" c="dimmed">
                    {t("Failed to generate QR code. Please try again.")}
                  </Text>
                </Center>
              )}
            </Stack>
          </form>
        </Stepper.Step>

        <Stepper.Step
          label={t("Backup")}
          description={t("Save codes")}
          icon={<IconKey size={18} />}
        >
          <Stack gap="md" mt="xl">
            <Alert
              icon={<IconAlertCircle size={20} />}
              title={t("Save your backup codes")}
              color="yellow"
            >
              <Text size="sm">
                {t(
                  "These codes can be used to access your account if you lose access to your authenticator app. Each code can only be used once.",
                )}
              </Text>
            </Alert>

            <Paper p="md" withBorder>
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={600}>
                  {t("Backup codes")}
                </Text>
                <Group gap="xs" wrap="nowrap">
                  <CopyButton value={backupCodes.join("\n")}>
                    {({ copied, copy }) => (
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={copy}
                        leftSection={
                          copied ? (
                            <IconCheck size={14} />
                          ) : (
                            <IconCopy size={14} />
                          )
                        }
                      >
                        {copied ? t("Copied") : t("Copy")}
                      </Button>
                    )}
                  </CopyButton>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={handlePrintBackupCodes}
                    leftSection={<IconPrinter size={14} />}
                  >
                    {t("Print")}
                  </Button>
                </Group>
              </Group>
              <List size="sm" spacing="xs">
                {backupCodes.map((code, index) => (
                  <List.Item key={index}>
                    <Code>{code}</Code>
                  </List.Item>
                ))}
              </List>
            </Paper>

            <Button
              fullWidth
              onClick={handleClose}
              leftSection={<IconCheck size={18} />}
            >
              {t("I've saved my backup codes")}
            </Button>
          </Stack>
        </Stepper.Step>
      </Stepper>
    </Modal>
  );
}
