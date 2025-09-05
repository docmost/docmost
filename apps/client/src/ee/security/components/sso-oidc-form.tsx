import React from "react";
import { z } from "zod";
import { useForm, zodResolver } from "@mantine/form";
import { Box, Button, Group, Stack, Switch, TextInput } from "@mantine/core";
import { buildCallbackUrl } from "@/ee/security/sso.utils.ts";
import classes from "@/ee/security/components/sso.module.css";
import { IAuthProvider } from "@/ee/security/types/security.types.ts";
import CopyTextButton from "@/components/common/copy.tsx";
import { useTranslation } from "react-i18next";
import { useUpdateSsoProviderMutation } from "@/ee/security/queries/security-query.ts";

const ssoSchema = z.object({
  name: z.string().min(1, "Display name is required"),
  oidcIssuer: z.string().url(),
  oidcClientId: z.string().min(1, "Client id is required"),
  oidcClientSecret: z.string().min(1, "Client secret is required"),
  isEnabled: z.boolean(),
  allowSignup: z.boolean(),
  groupSync: z.boolean(),
});

type SSOFormValues = z.infer<typeof ssoSchema>;

interface SsoFormProps {
  provider: IAuthProvider;
  onClose?: () => void;
}
export function SsoOIDCForm({ provider, onClose }: SsoFormProps) {
  const { t } = useTranslation();
  const updateSsoProviderMutation = useUpdateSsoProviderMutation();

  const form = useForm<SSOFormValues>({
    initialValues: {
      name: provider.name || "",
      oidcIssuer: provider.oidcIssuer || "",
      oidcClientId: provider.oidcClientId || "",
      oidcClientSecret: provider.oidcClientSecret || "",
      isEnabled: provider.isEnabled,
      allowSignup: provider.allowSignup,
      groupSync: provider.groupSync || false,
    },
    validate: zodResolver(ssoSchema),
  });

  const callbackUrl = buildCallbackUrl({
    providerId: provider.id,
    type: provider.type,
  });

  const handleSubmit = async (values: SSOFormValues) => {
    const ssoData: Partial<IAuthProvider> = {
      providerId: provider.id,
    };
    if (form.isDirty("name")) {
      ssoData.name = values.name;
    }
    if (form.isDirty("oidcIssuer")) {
      ssoData.oidcIssuer = values.oidcIssuer;
    }
    if (form.isDirty("oidcClientId")) {
      ssoData.oidcClientId = values.oidcClientId;
    }
    if (form.isDirty("oidcClientSecret")) {
      ssoData.oidcClientSecret = values.oidcClientSecret;
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

    await updateSsoProviderMutation.mutateAsync(ssoData);
    form.resetDirty();
    onClose();
  };

  return (
    <Box maw={600} mx="auto">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label={t("Display name")}
            placeholder="e.g Google SSO"
            data-autofocus
            {...form.getInputProps("name")}
          />
          <TextInput
            label="Callback URL"
            variant="filled"
            value={callbackUrl}
            pointer
            readOnly
            rightSection={<CopyTextButton text={callbackUrl} />}
          />
          <TextInput
            label="Issuer URL"
            description="Enter your OIDC issuer URL"
            placeholder="e.g https://accounts.google.com/"
            {...form.getInputProps("oidcIssuer")}
          />
          <TextInput
            label="Client ID"
            description="Enter your OIDC ClientId"
            placeholder="e.g 292085223830.apps.googleusercontent.com"
            {...form.getInputProps("oidcClientId")}
          />
          <TextInput
            label="Client Secret"
            description="Enter your OIDC Client Secret"
            placeholder="e.g OCSPX-zVCkotEPGRnJA1XKUrbgjlf7PQQ-"
            {...form.getInputProps("oidcClientSecret")}
          />

          <Group justify="space-between">
            <div>{t("Group sync")}</div>
            <Switch
              className={classes.switch}
              checked={form.values.groupSync}
              {...form.getInputProps("groupSync")}
            />
          </Group>

          <Group justify="space-between">
            <div>{t("Allow signup")}</div>
            <Switch
              className={classes.switch}
              checked={form.values.allowSignup}
              {...form.getInputProps("allowSignup")}
            />
          </Group>

          <Group justify="space-between">
            <div>{t("Enabled")}</div>
            <Switch
              className={classes.switch}
              checked={form.values.isEnabled}
              {...form.getInputProps("isEnabled")}
            />
          </Group>

          <Group mt="md" justify="flex-end">
            <Button type="submit" disabled={!form.isDirty()}>
              {t("Save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Box>
  );
}
