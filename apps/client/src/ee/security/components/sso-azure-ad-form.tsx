import { z } from "zod/v4";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import {
  Box,
  Button,
  Group,
  Stack,
  Switch,
  TextInput,
  Fieldset,
} from "@mantine/core";
import { buildCallbackUrl } from "@/ee/security/sso.utils.ts";
import { IAuthProvider } from "@/ee/security/types/security.types.ts";
import CopyTextButton from "@/components/common/copy.tsx";
import { useTranslation } from "react-i18next";
import { useUpdateSsoProviderMutation } from "@/ee/security/queries/security-query.ts";

const azureAdSchema = z.object({
  name: z.string().min(1, "Display name is required"),
  tenantId: z
    .string()
    .min(1, "Tenant ID is required")
    .regex(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
      "Invalid UUID format"
    ),
  clientId: z
    .string()
    .min(1, "Client ID is required")
    .regex(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
      "Invalid UUID format"
    ),
  clientSecret: z.string().min(1, "Client secret is required"),
  isEnabled: z.boolean(),
  allowSignup: z.boolean(),
  groupSync: z.boolean(),
  avatarSync: z.boolean(),
});

type SSOFormValues = z.infer<typeof azureAdSchema>;

interface SsoAzureAdFormProps {
  provider: IAuthProvider;
  onClose?: () => void;
}

export function SsoAzureAdForm({ provider, onClose }: Readonly<SsoAzureAdFormProps>) {
  const { t } = useTranslation();
  const updateSsoProviderMutation = useUpdateSsoProviderMutation();

  const form = useForm<SSOFormValues>({
    initialValues: {
      name: provider.name || "Azure AD",
      tenantId: provider.oidcIssuer?.split("/")[3] || "",
      clientId: provider.oidcClientId || "",
      clientSecret: provider.oidcClientSecret || "",
      isEnabled: provider.isEnabled,
      allowSignup: provider.allowSignup,
      groupSync: provider.groupSync || false,
      avatarSync: provider.avatarSync || false,
    },
    validate: zod4Resolver(azureAdSchema),
  });

  const callbackUrl = buildCallbackUrl({
    providerId: provider.id,
    type: provider.type,
  });

  const handleSubmit = async (values: SSOFormValues) => {
    const ssoData: Partial<IAuthProvider> = {
      providerId: provider.id,
    };

    // Keep type as 'azure-ad' - the server accepts both 'oidc' and
    // 'azure-ad' as OIDC-capable, and the client needs this exact type
    // value to keep building the singleton (no providerId) login/callback
    // URL Entra ID's fixed redirect URI requires.

    if (form.isDirty("name")) {
      ssoData.name = values.name;
    }
    if (form.isDirty("tenantId")) {
      ssoData.oidcIssuer = `https://login.microsoftonline.com/${values.tenantId}/v2.0`;
    }
    if (form.isDirty("clientId")) {
      ssoData.oidcClientId = values.clientId;
    }
    if (form.isDirty("clientSecret")) {
      ssoData.oidcClientSecret = values.clientSecret;
    }
    if (form.isDirty("isEnabled")) {
      ssoData.isEnabled = values.isEnabled;
    }
    if (form.isDirty("allowSignup")) {
      ssoData.allowSignup = values.allowSignup;
    }
    if (form.isDirty("groupSync")) {
      ssoData.groupSync = values.groupSync;
    }
    if (form.isDirty("avatarSync")) {
      ssoData.avatarSync = values.avatarSync;
    }

    await updateSsoProviderMutation.mutateAsync(ssoData);
    form.resetDirty();
    onClose?.();
  };

  return (
    <Box maw={600} mx="auto">
      <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
        <Stack>
          <TextInput
            label={t("Display name")}
            placeholder="e.g. Azure AD"
            data-autofocus
            {...form.getInputProps("name")}
          />

          <Fieldset legend={t("Azure AD Configuration")} disabled={false}>
            <Stack gap="sm">
              <TextInput
                label={t("Tenant ID")}
                description={t("Azure Directory (Tenant) ID in UUID format")}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                {...form.getInputProps("tenantId")}
              />

              <TextInput
                label={t("Client ID")}
                description={t("Application (Client) ID in UUID format")}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                {...form.getInputProps("clientId")}
              />

              <TextInput
                label={t("Client Secret")}
                description={t("Client secret from Azure app registration")}
                type="password"
                placeholder="••••••••••••••••"
                {...form.getInputProps("clientSecret")}
              />

              <TextInput
                label={t("Callback URL")}
                variant="filled"
                value={callbackUrl}
                pointer
                readOnly
                rightSection={<CopyTextButton text={callbackUrl} />}
              />
            </Stack>
          </Fieldset>

          <Fieldset legend={t("Settings")} disabled={false}>
            <Stack gap="sm">
              <Switch
                label={t("Enable provider")}
                description={t("Allow users to sign in with Azure AD")}
                checked={form.values.isEnabled}
                onChange={(event) =>
                  form.setFieldValue("isEnabled", event.currentTarget.checked)
                }
              />

              <Switch
                label={t("Allow signup")}
                description={t("Allow new users to sign up via Azure AD")}
                checked={form.values.allowSignup}
                onChange={(event) =>
                  form.setFieldValue("allowSignup", event.currentTarget.checked)
                }
              />

              <Switch
                label={t("Enable group sync")}
                description={t(
                  "Sync Azure AD groups and map to workspace roles"
                )}
                checked={form.values.groupSync}
                onChange={(event) =>
                  form.setFieldValue("groupSync", event.currentTarget.checked)
                }
              />

              <Switch
                label={t("Enable avatar sync")}
                description={t(
                  "Sync user profile photo from Azure AD"
                )}
                checked={form.values.avatarSync}
                onChange={(event) =>
                  form.setFieldValue("avatarSync", event.currentTarget.checked)
                }
              />
            </Stack>
          </Fieldset>

          <Group justify="flex-start">
            <Button
              size="sm"
              type="submit"
              loading={updateSsoProviderMutation.isPending}
            >
              {t("Save")}
            </Button>
            {onClose && (
              <Button size="sm" variant="light" onClick={onClose}>
                {t("Cancel")}
              </Button>
            )}
          </Group>
        </Stack>
      </form>
    </Box>
  );
}
