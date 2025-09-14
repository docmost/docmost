import { useState, useEffect } from "react";
import {
  Stack,
  TextInput,
  Switch,
  Button,
  Group,
  Card,
  Title,
  Text,
  Alert,
  PasswordInput,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { useTranslation } from "react-i18next";
import * as z from "zod";
import {
  useOidcProviderQuery,
  useCreateOidcProviderMutation,
  useUpdateOidcProviderMutation,
  useDeleteOidcProviderMutation,
} from "@/features/auth/queries/oidc-query";
import { ICreateOidcProvider } from "@/features/auth/services/oidc-service";
import { IconInfoCircle, IconTrash } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query";

const createSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  oidcIssuer: z.string().url({ message: "Valid issuer URL is required" }),
  oidcClientId: z.string().min(1, { message: "Client ID is required" }),
  oidcClientSecret: z.string().min(1, { message: "Client secret is required" }),
  allowSignup: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  enforceSso: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  oidcIssuer: z.string().url({ message: "Valid issuer URL is required" }),
  oidcClientId: z.string().min(1, { message: "Client ID is required" }),
  oidcClientSecret: z.string().optional(),
  allowSignup: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  enforceSso: z.boolean().optional(),
});

export function OidcProviderForm() {
  const { t } = useTranslation();
  const { data: provider, isLoading } = useOidcProviderQuery();
  const { data: workspaceData } = useWorkspacePublicDataQuery();
  const createMutation = useCreateOidcProviderMutation();
  const updateMutation = useUpdateOidcProviderMutation();
  const deleteMutation = useDeleteOidcProviderMutation();

  const form = useForm<ICreateOidcProvider>({
    validate: zodResolver(provider ? updateSchema : createSchema),
    initialValues: {
      name: "",
      oidcIssuer: "",
      oidcClientId: "",
      oidcClientSecret: "",
      allowSignup: true,
      isEnabled: true,
      enforceSso: false,
    },
  });

  // Update form values when provider data is loaded
  useEffect(() => {
    if (provider) {
      form.setValues({
        name: provider.name,
        oidcIssuer: provider.oidcIssuer,
        oidcClientId: provider.oidcClientId,
        oidcClientSecret: "",
        allowSignup: provider.allowSignup,
        isEnabled: provider.isEnabled,
        enforceSso: workspaceData?.enforceSso || false,
      });
    }
  }, [provider, workspaceData?.enforceSso]);

  const handleSubmit = async (values: ICreateOidcProvider) => {
    try {
      if (provider) {
        await updateMutation.mutateAsync({ id: provider.id, data: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      form.reset();
    } catch (error) {
      // 
    }
  };

  const handleDelete = () => {
    if (!provider) return;

    modals.openConfirmModal({
      title: t("Delete OIDC Provider"),
      children: (
        <Text size="sm">
          {t("Are you sure you want to delete this OIDC provider? This action cannot be undone.")}
        </Text>
      ),
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => deleteMutation.mutate(provider.id),
    });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3}>{t("OIDC/SSO Configuration")}</Title>
          {provider && (
            <Button
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              {t("Delete")}
            </Button>
          )}
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} title={t("Information")}>
          <Text size="sm">
            {t("Configure your OIDC provider to enable single sign-on. The redirect URI should be: ")}
            <code>{window.location.origin}/auth/oidc/callback</code>
          </Text>
        </Alert>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label={t("Provider Name")}
              placeholder={t("Enter provider name")}
              {...form.getInputProps("name")}
            />

            <TextInput
              label={t("Issuer URL")}
              placeholder="https://example.com"
              {...form.getInputProps("oidcIssuer")}
            />

            <TextInput
              label={t("Client ID")}
              placeholder={t("Enter client ID")}
              {...form.getInputProps("oidcClientId")}
            />

            <PasswordInput
              label={t("Client Secret")}
              placeholder={provider ? t("Leave empty to keep current secret") : t("Enter client secret")}
              description={provider ? t("Only enter a new secret if you want to change it") : undefined}
              {...form.getInputProps("oidcClientSecret")}
            />

            <Switch
              label={t("Allow user signup")}
              description={t("Allow new users to sign up via OIDC")}
              {...form.getInputProps("allowSignup", { type: "checkbox" })}
            />

            <Switch
              label={t("Enable provider")}
              description={t("Enable this OIDC provider")}
              {...form.getInputProps("isEnabled", { type: "checkbox" })}
            />

            <Switch
              label={t("Force SSO")}
              description={t("Force all users to use SSO for login (disables regular login)")}
              {...form.getInputProps("enforceSso", { type: "checkbox" })}
            />

            <Group justify="flex-end" mt="md">
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {provider ? t("Update") : t("Create")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}
