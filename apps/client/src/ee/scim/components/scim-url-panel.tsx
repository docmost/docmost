import { Group, Stack, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import CopyTextButton from "@/components/common/copy.tsx";

export function ScimUrlPanel() {
  const { t } = useTranslation();
  const scimUrl = `${window.location.origin}/api/scim/v2`;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {t("SCIM endpoint URL")}
      </Text>
      <Text size="xs" c="dimmed">
        {t(
          "Configure your identity provider with this URL to provision users and groups.",
        )}
      </Text>
      <Group gap="xs" wrap="nowrap">
        <TextInput
          variant="filled"
          style={{ flex: 1 }}
          value={scimUrl}
          readOnly
        />
        <CopyTextButton text={scimUrl} />
      </Group>
    </Stack>
  );
}
