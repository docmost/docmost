import { useState } from "react";
import { useAtom } from "jotai";
import { z } from "zod/v4";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import {
  Alert,
  Button,
  Code,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { getAppName } from "@/lib/config.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import {
  useCreateOidcProviderMutation,
  useDisableOidcProviderMutation,
  useEnableOidcProviderMutation,
  useOidcProvidersQuery,
  useUpdateOidcProviderMutation,
} from "@/features/oidc/queries/oidc-query.ts";
import { IOidcProvider } from "@/features/oidc/types/oidc.types.ts";

const providerSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  oidcIssuer: z.url(),
  oidcClientId: z.string().trim().min(1),
  oidcClientSecret: z.string().trim().optional(),
  domains: z.string().optional(),
  autoJoinByEmail: z.boolean(),
  autoCreateUsers: z.boolean(),
});

type ProviderFormValues = z.infer<typeof providerSchema>;

function splitDomains(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean);
}

function ProviderEditor({ provider }: { provider: IOidcProvider }) {
  const updateMutation = useUpdateOidcProviderMutation(provider.id);
  const enableMutation = useEnableOidcProviderMutation(provider.id);
  const disableMutation = useDisableOidcProviderMutation(provider.id);

  const form = useForm<ProviderFormValues>({
    validate: zod4Resolver(providerSchema),
    initialValues: {
      name: provider.name,
      slug: provider.slug,
      oidcIssuer: provider.oidcIssuer,
      oidcClientId: provider.oidcClientId,
      oidcClientSecret: "",
      domains: provider.domains.join(", "),
      autoJoinByEmail: provider.autoJoinByEmail,
      autoCreateUsers: provider.autoCreateUsers,
    },
  });

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Text fw={600}>{provider.name}</Text>
        <Code>{provider.oidcRedirectUri}</Code>

        <form
          onSubmit={form.onSubmit(async (values) => {
            await updateMutation.mutateAsync({
              name: values.name,
              slug: values.slug,
              oidcIssuer: values.oidcIssuer,
              oidcClientId: values.oidcClientId,
              oidcClientSecret: values.oidcClientSecret || undefined,
              domains: splitDomains(values.domains),
              autoJoinByEmail: values.autoJoinByEmail,
              autoCreateUsers: values.autoCreateUsers,
            });
            form.setFieldValue("oidcClientSecret", "");
            form.resetDirty();
          })}
        >
          <Stack gap="sm">
            <TextInput label="Name" {...form.getInputProps("name")} />
            <TextInput label="Slug" {...form.getInputProps("slug")} />
            <TextInput label="Issuer URL" {...form.getInputProps("oidcIssuer")} />
            <TextInput
              label="Client ID"
              {...form.getInputProps("oidcClientId")}
            />
            <PasswordInput
              label="Client Secret"
              placeholder={provider.hasClientSecret ? "Leave blank to keep current secret" : ""}
              {...form.getInputProps("oidcClientSecret")}
            />
            <TextInput
              label="Allowed email domains"
              description="Comma-separated"
              {...form.getInputProps("domains")}
            />
            <Switch
              label="Auto-link existing users by email"
              checked={form.values.autoJoinByEmail}
              onChange={(event) =>
                form.setFieldValue("autoJoinByEmail", event.currentTarget.checked)
              }
            />
            <Switch
              label="Auto-create users"
              checked={form.values.autoCreateUsers}
              onChange={(event) =>
                form.setFieldValue("autoCreateUsers", event.currentTarget.checked)
              }
            />
            <Group justify="space-between">
              <Button
                type="submit"
                loading={updateMutation.isPending}
                disabled={!form.isDirty()}
              >
                Save
              </Button>
              <Button
                variant={provider.isEnabled ? "default" : "filled"}
                color={provider.isEnabled ? "gray" : undefined}
                loading={enableMutation.isPending || disableMutation.isPending}
                onClick={() =>
                  provider.isEnabled
                    ? disableMutation.mutate()
                    : enableMutation.mutate()
                }
              >
                {provider.isEnabled ? "Disable" : "Enable"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}

export default function OidcSettings() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const { data: providers = [] } = useOidcProvidersQuery();
  const createMutation = useCreateOidcProviderMutation();
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);

  const createForm = useForm<ProviderFormValues>({
    validate: zod4Resolver(providerSchema),
    initialValues: {
      name: "",
      slug: "",
      oidcIssuer: "",
      oidcClientId: "",
      oidcClientSecret: "",
      domains: "",
      autoJoinByEmail: true,
      autoCreateUsers: false,
    },
  });

  if (!isAdmin) {
    return (
      <>
        <Helmet>
          <title>OIDC Settings - {getAppName()}</title>
        </Helmet>
        <SettingsTitle title="OIDC" />
        <Alert color="red">Only workspace admins can manage OIDC settings.</Alert>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>OIDC Settings - {getAppName()}</title>
      </Helmet>

      <SettingsTitle title="OIDC" />

      <Stack gap="md">
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Text fw={600}>{t("Enforce OIDC login")}</Text>
            <Text size="sm" c="dimmed">
              When enabled, password login and password recovery are disabled.
            </Text>
            <Switch
              checked={workspace?.enforceSso ?? false}
              onChange={async (event) => {
                const checked = event.currentTarget.checked;
                setIsSavingWorkspace(true);
                try {
                  const updatedWorkspace = await updateWorkspace({
                    enforceSso: checked,
                  });
                  setWorkspace(updatedWorkspace);
                  notifications.show({ message: "Workspace updated" });
                } catch (error) {
                  notifications.show({
                    message:
                      error["response"]?.data?.message ??
                      "Failed to update workspace",
                    color: "red",
                  });
                } finally {
                  setIsSavingWorkspace(false);
                }
              }}
              disabled={isSavingWorkspace}
              label={workspace?.enforceSso ? "OIDC enforced" : "OIDC optional"}
            />
          </Stack>
        </Paper>

        <Paper withBorder p="md">
          <form
            onSubmit={createForm.onSubmit(async (values) => {
              await createMutation.mutateAsync({
                name: values.name,
                slug: values.slug,
                oidcIssuer: values.oidcIssuer,
                oidcClientId: values.oidcClientId,
                oidcClientSecret: values.oidcClientSecret ?? "",
                domains: splitDomains(values.domains),
                autoJoinByEmail: values.autoJoinByEmail,
                autoCreateUsers: values.autoCreateUsers,
              });
              createForm.reset();
            })}
          >
            <Stack gap="sm">
              <Text fw={600}>Add OIDC provider</Text>
              <TextInput label="Name" {...createForm.getInputProps("name")} />
              <TextInput label="Slug" {...createForm.getInputProps("slug")} />
              <TextInput
                label="Issuer URL"
                placeholder="https://issuer.example.com"
                {...createForm.getInputProps("oidcIssuer")}
              />
              <TextInput
                label="Client ID"
                {...createForm.getInputProps("oidcClientId")}
              />
              <PasswordInput
                label="Client Secret"
                {...createForm.getInputProps("oidcClientSecret")}
              />
              <TextInput
                label="Allowed email domains"
                description="Comma-separated"
                {...createForm.getInputProps("domains")}
              />
              <Switch
                label="Auto-link existing users by email"
                checked={createForm.values.autoJoinByEmail}
                onChange={(event) =>
                  createForm.setFieldValue(
                    "autoJoinByEmail",
                    event.currentTarget.checked,
                  )
                }
              />
              <Switch
                label="Auto-create users"
                checked={createForm.values.autoCreateUsers}
                onChange={(event) =>
                  createForm.setFieldValue(
                    "autoCreateUsers",
                    event.currentTarget.checked,
                  )
                }
              />
              <Button type="submit" loading={createMutation.isPending}>
                Create provider
              </Button>
            </Stack>
          </form>
        </Paper>

        <Stack gap="sm">
          {providers.map((provider) => (
            <ProviderEditor key={provider.id} provider={provider} />
          ))}

          {providers.length === 0 && (
            <Text size="sm" c="dimmed">
              No OIDC providers configured yet.
            </Text>
          )}
        </Stack>
      </Stack>
    </>
  );
}
