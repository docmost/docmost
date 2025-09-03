import React from "react";
import { z } from "zod";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import {
  Box,
  Button,
  Group,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from "@mantine/core";
import {
  buildCallbackUrl,
  buildSamlEntityId,
} from "@/ee/security/sso.utils.ts";
import classes from "@/ee/security/components/sso.module.css";
import { IAuthProvider } from "@/ee/security/types/security.types.ts";
import CopyTextButton from "@/components/common/copy.tsx";
import { useTranslation } from "react-i18next";
import { useUpdateSsoProviderMutation } from "@/ee/security/queries/security-query.ts";

const ssoSchema = z.object({
  name: z.string().min(1, "Display name is required"),
  samlUrl: z.string().url(),
  samlCertificate: z.string().min(1, "SAML Idp Certificate is required"),
  isEnabled: z.boolean(),
  allowSignup: z.boolean(),
  groupSync: z.boolean(),
});

type SSOFormValues = z.infer<typeof ssoSchema>;

interface SsoFormProps {
  provider: IAuthProvider;
  onClose?: () => void;
}
export function SsoSamlForm({ provider, onClose }: SsoFormProps) {
  const { t } = useTranslation();
  const updateSsoProviderMutation = useUpdateSsoProviderMutation();

  const form = useForm<SSOFormValues>({
    initialValues: {
      name: provider.name || "",
      samlUrl: provider.samlUrl || "",
      samlCertificate: provider.samlCertificate || "",
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

  const samlEntityId = buildSamlEntityId(provider.id);

  const handleSubmit = async (values: SSOFormValues) => {
    const ssoData: Partial<IAuthProvider> = {
      providerId: provider.id,
    };
    if (form.isDirty("name")) {
      ssoData.name = values.name;
    }
    if (form.isDirty("samlUrl")) {
      ssoData.samlUrl = values.samlUrl;
    }
    if (form.isDirty("samlCertificate")) {
      ssoData.samlCertificate = values.samlCertificate;
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
            placeholder="e.g Azure Entra"
            data-autofocus
            {...form.getInputProps("name")}
          />
          <TextInput
            label="Entity ID"
            variant="filled"
            value={buildSamlEntityId(provider.id)}
            rightSection={<CopyTextButton text={samlEntityId} />}
            pointer
            readOnly
          />
          <TextInput
            label="Callback URL (ACS)"
            variant="filled"
            value={callbackUrl}
            pointer
            readOnly
            rightSection={<CopyTextButton text={callbackUrl} />}
          />
          <TextInput
            label="IDP Login URL"
            description="Enter your IDP login URL"
            placeholder="e.g https://login.microsoftonline.com/7d6246d1-273b-4981-ad1e-e7bb27b86569/saml2"
            {...form.getInputProps("samlUrl")}
          />
          <Textarea
            label="IDP Certificate"
            description="Enter your IDP certificate"
            placeholder="-----BEGIN CERTIFICATE-----"
            autosize
            minRows={3}
            maxRows={5}
            {...form.getInputProps("samlCertificate")}
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
