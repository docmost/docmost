import React from "react";
import { Container, Paper, Title, Text, Alert, Stack } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { MfaSetupModal } from "@/ee/mfa";
import APP_ROUTE from "@/lib/app-route.ts";
import { useNavigate } from "react-router-dom";

export default function MfaSetupRequired() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleSetupComplete = () => {
    navigate(APP_ROUTE.HOME);
  };

  return (
    <Container size="sm" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack>
          <Title order={2} ta="center">
            {t("Two-factor authentication required")}
          </Title>

          <Alert icon={<IconAlertCircle size="1rem" />} color="yellow">
            <Text size="sm">
              {t(
                "Your workspace requires two-factor authentication. Please set it up to continue.",
              )}
            </Text>
          </Alert>

          <Text c="dimmed" size="sm" ta="center">
            {t(
              "This adds an extra layer of security to your account by requiring a verification code from your authenticator app.",
            )}
          </Text>

          <MfaSetupModal
            opened={true}
            onComplete={handleSetupComplete}
            isRequired={true}
          />
        </Stack>
      </Paper>
    </Container>
  );
}
