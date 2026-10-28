import { Button, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getOAuthAuthorizeUrl } from "@/features/integration/services/integration-service";
import { getIntegrationIcon } from "@/features/integration/components/integration-icons";
import { M365NeedsConnection } from "@/features/microsoft/types/microsoft.types";

export function startMicrosoftConnect(
  needsConnection: M365NeedsConnection,
  onError: (message: string) => void,
) {
  if (!needsConnection.integrationId) {
    onError("");
    return Promise.resolve();
  }
  return getOAuthAuthorizeUrl({
    integrationId: needsConnection.integrationId,
    returnPath: window.location.pathname,
  })
    .then((result) => {
      window.location.href = result.authorizationUrl;
    })
    .catch((error) => onError(error?.["response"]?.data?.message ?? ""));
}

export function PickerNeedsConnection({ needsConnection }: { needsConnection: M365NeedsConnection }) {
  const { t } = useTranslation();
  const [connecting, setConnecting] = useState(false);

  const connect = () => {
    setConnecting(true);
    void startMicrosoftConnect(needsConnection, (message) => {
      setConnecting(false);
      notifications.show({ message: message || t("Failed to start OAuth connection"), color: "red" });
    });
  };

  return (
    <Stack align="center" gap="sm" py="xl">
      {getIntegrationIcon("microsoft_365", 36)}
      <Text size="sm" c="dimmed" ta="center">
        {t("Connect your Microsoft 365 account to browse SharePoint")}
      </Text>
      <Button color="dark" loading={connecting} onClick={connect}>
        {t("Connect to {{name}} to preview", { name: needsConnection.integrationName ?? "Microsoft 365" })}
      </Button>
    </Stack>
  );
}
