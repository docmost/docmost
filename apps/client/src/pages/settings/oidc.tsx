import { Container, Stack, Title, Paper } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { OidcProviderForm } from "@/features/auth/components/oidc-provider-form";

export default function OidcSettingsPage() {
  const { t } = useTranslation();

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Title order={1}>{t("OIDC/SSO Settings")}</Title>
        <Paper shadow="sm" radius="md" withBorder>
          <OidcProviderForm />
        </Paper>
      </Stack>
    </Container>
  );
}
