import { Anchor, Button, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MicrosoftFileItem } from "@docmost/editor-ext";
import { fileTypeIcon } from "@/features/microsoft/utils/file-type-icon";
import { M365NeedsConnection } from "@/features/microsoft/types/microsoft.types";
import { startMicrosoftConnect } from "@/features/microsoft/picker/picker-needs-connection";
import classes from "./microsoft-file.module.css";

type Props = {
  item: MicrosoftFileItem;
  description: string;
  needsConnection?: M365NeedsConnection | null;
  kind?: "file" | "folder";
  onRetry?: () => void;
};

export function FileStateCard({ item, description, needsConnection, kind, onRetry }: Props) {
  const { t } = useTranslation();
  const [connecting, setConnecting] = useState(false);

  const connect = () => {
    if (!needsConnection) return;
    setConnecting(true);
    void startMicrosoftConnect(needsConnection, (message) => {
      setConnecting(false);
      notifications.show({ message: message || t("Failed to start OAuth connection"), color: "red" });
    });
  };

  return (
    <div className={classes.centered}>
      <Stack gap="xs" align="center" style={{ maxWidth: 420 }}>
        {fileTypeIcon({ name: item.name, kind, size: 36 })}
        <Text size="sm" fw={600} ta="center" truncate style={{ maxWidth: "100%" }}>
          {item.name || item.webUrl}
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          {description}
        </Text>
        <Group gap="xs">
          {needsConnection && (
            <Button size="xs" color="dark" loading={connecting} onClick={connect}>
              {t("Connect to {{name}} to preview", {
                name: needsConnection.integrationName ?? "Microsoft 365",
              })}
            </Button>
          )}
          {onRetry && (
            <Button size="xs" variant="default" onClick={onRetry}>
              {t("Try again")}
            </Button>
          )}
          <Anchor href={item.webUrl} target="_blank" rel="noopener" size="xs">
            {t("Open in SharePoint")}
          </Anchor>
        </Group>
      </Stack>
    </div>
  );
}
