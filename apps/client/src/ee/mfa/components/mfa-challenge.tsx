import React, { useState } from "react";
import {
  Container,
  Title,
  Text,
  PinInput,
  Button,
  Stack,
  Anchor,
  Paper,
  Center,
  ThemeIcon,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { IconDeviceMobile, IconLock } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import classes from "./mfa-challenge.module.css";
import { verifyMfa } from "@/ee/mfa";
import APP_ROUTE from "@/lib/app-route";
import { useTranslation } from "react-i18next";
import * as z from "zod";
import { MfaBackupCodeInput } from "./mfa-backup-code-input";

const formSchema = z.object({
  code: z
    .string()
    .refine(
      (val) => (val.length === 6 && /^\d{6}$/.test(val)) || val.length === 8,
      {
        message: "Enter a 6-digit code or 8-character backup code",
      },
    ),
});

type MfaChallengeFormValues = z.infer<typeof formSchema>;

export function MfaChallenge() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  const form = useForm<MfaChallengeFormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      code: "",
    },
  });

  const handleSubmit = async (values: MfaChallengeFormValues) => {
    setIsLoading(true);
    try {
      await verifyMfa(values.code);
      navigate(APP_ROUTE.HOME);
    } catch (error: any) {
      setIsLoading(false);
      notifications.show({
        message:
          error.response?.data?.message || t("Invalid verification code"),
        color: "red",
      });
      form.setFieldValue("code", "");
    }
  };

  return (
    <Container size={420} className={classes.container}>
      <Paper radius="lg" p={40} className={classes.paper}>
        <Stack align="center" gap="xl">
          <Center>
            <ThemeIcon size={80} radius="xl" variant="light" color="blue">
              <IconDeviceMobile size={40} stroke={1.5} />
            </ThemeIcon>
          </Center>

          <Stack align="center" gap="xs">
            <Title order={2} ta="center" fw={600}>
              {t("Two-factor authentication")}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {useBackupCode
                ? t("Enter one of your backup codes")
                : t("Enter the 6-digit code found in your authenticator app")}
            </Text>
          </Stack>

          {!useBackupCode ? (
            <form
              onSubmit={form.onSubmit(handleSubmit)}
              style={{ width: "100%" }}
            >
              <Stack gap="lg">
                <Center>
                  <PinInput
                    length={6}
                    type="number"
                    autoFocus
                    data-autofocus
                    oneTimeCode
                    {...form.getInputProps("code")}
                    error={!!form.errors.code}
                    styles={{
                      input: {
                        fontSize: "1.2rem",
                        textAlign: "center",
                      },
                    }}
                  />
                </Center>
                {form.errors.code && (
                  <Text c="red" size="sm" ta="center">
                    {form.errors.code}
                  </Text>
                )}

                <Button
                  type="submit"
                  fullWidth
                  size="md"
                  loading={isLoading}
                  leftSection={<IconLock size={18} />}
                >
                  {t("Verify")}
                </Button>

                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  c="dimmed"
                  onClick={() => {
                    setUseBackupCode(true);
                    form.setFieldValue("code", "");
                    form.clearErrors();
                  }}
                >
                  {t("Use backup code")}
                </Anchor>
              </Stack>
            </form>
          ) : (
            <MfaBackupCodeInput
              value={form.values.code}
              onChange={(value) => form.setFieldValue("code", value)}
              error={form.errors.code?.toString()}
              onSubmit={() => handleSubmit(form.values)}
              onCancel={() => {
                setUseBackupCode(false);
                form.setFieldValue("code", "");
                form.clearErrors();
              }}
              isLoading={isLoading}
            />
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
