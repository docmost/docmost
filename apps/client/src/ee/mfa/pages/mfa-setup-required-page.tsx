import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Title,
  Text,
  Button,
  Stack,
  Paper,
  Alert,
  Center,
  ThemeIcon,
} from "@mantine/core";
import { IconShieldCheck, IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import APP_ROUTE from "@/lib/app-route";
import { MfaSetupModal } from "@/ee/mfa";
import classes from "@/features/auth/components/auth.module.css";
import { notifications } from "@mantine/notifications";
import { useMfaPageProtection } from "@/ee/mfa";

export function MfaSetupRequiredPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const { isValid } = useMfaPageProtection();

  const handleSetupComplete = async () => {
    setSetupModalOpen(false);

    notifications.show({
      title: t("Success"),
      message: t(
        "Two-factor authentication has been set up. Please log in again.",
      ),
    });

    navigate(APP_ROUTE.AUTH.LOGIN);
  };

  const handleLogout = () => {
    navigate(APP_ROUTE.AUTH.LOGIN);
  };

  if (!isValid) {
    return null;
  }

  return (
    <Container size={480} className={classes.container}>
      <Paper radius="lg" p={40}>
        <Stack align="center" gap="xl">
          <Center>
            <ThemeIcon size={80} radius="xl" variant="light" color="blue">
              <IconShieldCheck size={40} stroke={1.5} />
            </ThemeIcon>
          </Center>

          <Stack align="center" gap="xs">
            <Title order={2} ta="center" fw={600}>
              {t("Two-factor authentication required")}
            </Title>
            <Text size="md" c="dimmed" ta="center">
              {t(
                "Your workspace requires two-factor authentication for all users",
              )}
            </Text>
          </Stack>

          <Alert
            icon={<IconAlertCircle size={20} />}
            color="blue"
            variant="light"
            w="100%"
          >
            <Text size="sm">
              {t(
                "To continue accessing your workspace, you must set up two-factor authentication. This adds an extra layer of security to your account.",
              )}
            </Text>
          </Alert>

          <Stack w="100%" gap="sm">
            <Button
              fullWidth
              size="md"
              onClick={() => setSetupModalOpen(true)}
              leftSection={<IconShieldCheck size={18} />}
            >
              {t("Set up two-factor authentication")}
            </Button>

            <Button
              fullWidth
              variant="subtle"
              color="gray"
              onClick={handleLogout}
            >
              {t("Cancel and logout")}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <MfaSetupModal
        opened={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        onComplete={handleSetupComplete}
        isRequired={true}
      />
    </Container>
  );
}
