import {
  Alert,
  Code,
  Group,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useSsoConfigQuery,
  useUpdateSsoConfigMutation,
} from "@/features/sso/queries/sso-query.ts";

export default function GoogleSsoSettings() {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSsoConfigQuery();
  const updateMutation = useUpdateSsoConfigMutation();

  if (isLoading || !config) return null;

  return (
    <>
      {!config.credentialsConfigured && (
        <Alert
          variant="light"
          color="orange"
          icon={<IconInfoCircle />}
          mb="md"
        >
          {t(
            "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server to enable Google sign-in.",
          )}
        </Alert>
      )}

      <Alert variant="light" color="gray" mb="md">
        <Text size="sm" mb={4}>
          {t("Add this redirect URI to your Google OAuth client:")}
        </Text>
        <Code>{config.callbackUrl}</Code>
      </Alert>

      <Group justify="space-between" wrap="nowrap" my="md">
        <div>
          <Text size="md">{t("Enable Google sign-in")}</Text>
          <Text size="sm" c="dimmed">
            {t("Show a \"Continue with Google\" button on the login page.")}
          </Text>
        </div>
        <Switch
          checked={config.isEnabled}
          disabled={!config.credentialsConfigured || updateMutation.isPending}
          onChange={(event) =>
            updateMutation.mutate({ isEnabled: event.currentTarget.checked })
          }
        />
      </Group>

      <Group justify="space-between" wrap="nowrap" my="md">
        <div>
          <Text size="md">{t("Allow signup")}</Text>
          <Text size="sm" c="dimmed">
            {t(
              "Create an account automatically the first time someone signs in with Google.",
            )}
          </Text>
        </div>
        <Switch
          checked={config.allowSignup}
          disabled={updateMutation.isPending}
          onChange={(event) =>
            updateMutation.mutate({ allowSignup: event.currentTarget.checked })
          }
        />
      </Group>

      <Group justify="space-between" wrap="nowrap" my="md">
        <div>
          <Text size="md">{t("Sync Google groups")}</Text>
          <Text size="sm" c="dimmed">
            {t(
              "Apply the group mappings below when someone signs in, and when you resync.",
            )}
          </Text>
        </div>
        <Tooltip
          label={t(
            "Set GOOGLE_SERVICE_ACCOUNT_KEY on the server to use group sync.",
          )}
          disabled={config.groupSyncConfigured}
        >
          <Switch
            checked={config.groupSync}
            disabled={!config.groupSyncConfigured || updateMutation.isPending}
            onChange={(event) =>
              updateMutation.mutate({ groupSync: event.currentTarget.checked })
            }
          />
        </Tooltip>
      </Group>
    </>
  );
}
