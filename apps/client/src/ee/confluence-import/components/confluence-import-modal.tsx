import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  ScrollArea,
  SegmentedControl,
  Stack,
  Stepper,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCheck,
  IconCloudCheck,
  IconPlug,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import {
  listConfluenceSpaces,
  startConfluenceImport,
  testConfluenceConnection,
} from "@/ee/confluence-import/services/confluence-import-service";
import {
  ConfluenceAuthType,
  ConfluenceCredentials,
  ConfluenceSpaceSummary,
} from "@/ee/confluence-import/types/confluence-import.types";
import { confluenceImportsQueryKey } from "@/ee/confluence-import/queries/confluence-import-queries";

type ConfluenceEditionChoice = "cloud" | "server";

type CredentialsFormValues = {
  edition: ConfluenceEditionChoice;
  authType: ConfluenceAuthType;
  siteUrl: string;
  email: string;
  token: string;
  username: string;
  password: string;
};

type Props = {
  opened: boolean;
  onClose: () => void;
};

export default function ConfluenceImportModal({ opened, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<ConfluenceSpaceSummary[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [importAll, setImportAll] = useState(true);

  const form = useForm<CredentialsFormValues>({
    initialValues: {
      edition: "server",
      authType: "pat",
      siteUrl: "",
      email: "",
      token: "",
      username: "",
      password: "",
    },
    validate: {
      siteUrl: (value) =>
        !value?.trim()
          ? t("Site URL is required")
          : !/^https?:\/\//i.test(value.trim())
            ? t("Site URL must start with http:// or https://")
            : null,
      email: (value, values) =>
        values.edition === "cloud" && !value?.trim()
          ? t("Email is required")
          : null,
      token: (value, values) =>
        (values.authType === "cloud_token" || values.authType === "pat") &&
        !value?.trim()
          ? t("API token is required")
          : null,
      username: (value, values) =>
        values.authType === "basic" && !value?.trim()
          ? t("Username is required")
          : null,
      password: (value, values) =>
        values.authType === "basic" && !value?.trim()
          ? t("Password is required")
          : null,
    },
  });

  useEffect(() => {
    if (!opened) {
      setActive(0);
      setError(null);
      setSpaces([]);
      setSelectedKeys([]);
      setImportAll(true);
      setLoading(false);
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const credentials: ConfluenceCredentials = useMemo(() => {
    const values = form.values;
    return {
      siteUrl: values.siteUrl.trim().replace(/\/+$/, ""),
      authType: values.authType,
      email: values.email?.trim() || undefined,
      token: values.token?.trim() || undefined,
      username: values.username?.trim() || undefined,
      password: values.password || undefined,
    };
  }, [form.values]);

  const handleEditionChange = (edition: ConfluenceEditionChoice) => {
    form.setFieldValue("edition", edition);
    if (edition === "cloud") {
      form.setFieldValue("authType", "cloud_token");
    } else if (form.values.authType === "cloud_token") {
      form.setFieldValue("authType", "pat");
    }
  };

  const handleNextFromCredentials = async () => {
    if (form.validate().hasErrors) return;
    setLoading(true);
    setError(null);
    try {
      const test = await testConfluenceConnection(credentials);
      if (!test.success) {
        setError(test.error || t("Connection failed"));
        return;
      }
      const list = await listConfluenceSpaces(credentials);
      if (!list.success || !list.spaces) {
        setError(list.error || t("Failed to load spaces"));
        return;
      }
      setSpaces(list.spaces);
      setSelectedKeys(list.spaces.map((s) => s.key));
      setImportAll(true);
      setActive(1);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t("Unexpected error"));
    } finally {
      setLoading(false);
    }
  };

  const toggleSpace = (key: string, checked: boolean) => {
    setSelectedKeys((prev) =>
      checked ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key),
    );
  };

  const toggleAll = (checked: boolean) => {
    setImportAll(checked);
    setSelectedKeys(checked ? spaces.map((s) => s.key) : []);
  };

  const handleStartImport = async () => {
    const spaceKeys = importAll ? [] : selectedKeys;
    if (!importAll && spaceKeys.length === 0) {
      setError(t("Select at least one space to import"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await startConfluenceImport({
        ...credentials,
        spaceKeys,
      });
      if (!result.success || !result.fileTaskId) {
        setError(result.error || t("Failed to start import"));
        setLoading(false);
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: confluenceImportsQueryKey,
      });

      notifications.show({
        title: t("Confluence import started"),
        message: t("Track progress below. This runs in the background."),
        color: "blue",
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });

      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || t("Unexpected error"),
      );
      setLoading(false);
    }
  };

  const handleCancelFlow = async () => {
    onClose();
  };

  const editionSegment = (
    <SegmentedControl
      value={form.values.edition}
      onChange={(val) => handleEditionChange(val as ConfluenceEditionChoice)}
      data={[
        { value: "server", label: t("Data Center / Server") },
        { value: "cloud", label: t("Cloud") },
      ]}
      fullWidth
    />
  );

  const authTypeSegment = form.values.edition === "server" && (
    <SegmentedControl
      value={form.values.authType}
      onChange={(val) =>
        form.setFieldValue("authType", val as ConfluenceAuthType)
      }
      data={[
        { value: "pat", label: t("Personal Access Token") },
        { value: "basic", label: t("Username + password") },
      ]}
      fullWidth
    />
  );

  const selectedCount = importAll ? spaces.length : selectedKeys.length;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Import from Confluence")}
      size={720}
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Stepper active={active} size="sm" mb="md" allowNextStepsSelect={false}>
        <Stepper.Step
          label={t("Connect")}
          description={t("Credentials")}
          icon={<IconPlug size={18} />}
        />
        <Stepper.Step
          label={t("Select spaces")}
          description={t("Choose what to import")}
          icon={<IconCloudCheck size={18} />}
        />
      </Stepper>

      {active === 0 && (
        <Stack>
          <Text size="sm" c="dimmed">
            {t(
              "Enter your Confluence URL and credentials. We'll validate the connection before continuing.",
            )}
          </Text>
          {editionSegment}
          {authTypeSegment}
          <TextInput
            label={t("Site URL")}
            placeholder={
              form.values.edition === "cloud"
                ? "https://your-site.atlassian.net/wiki"
                : "https://confluence.example.com"
            }
            required
            {...form.getInputProps("siteUrl")}
          />

          {form.values.edition === "cloud" && (
            <>
              <TextInput
                label={t("Email")}
                placeholder="you@company.com"
                required
                {...form.getInputProps("email")}
              />
              <PasswordInput
                label={t("API token")}
                description={t(
                  "Create at id.atlassian.com/manage-profile/security/api-tokens",
                )}
                required
                {...form.getInputProps("token")}
              />
            </>
          )}

          {form.values.edition === "server" &&
            form.values.authType === "pat" && (
              <>
                <TextInput
                  label={t("Email")}
                  placeholder="you@company.com"
                  {...form.getInputProps("email")}
                />
                <PasswordInput
                  label={t("Personal Access Token")}
                  required
                  {...form.getInputProps("token")}
                />
              </>
            )}

          {form.values.edition === "server" &&
            form.values.authType === "basic" && (
              <>
                <TextInput
                  label={t("Username")}
                  required
                  {...form.getInputProps("username")}
                />
                <PasswordInput
                  label={t("Password")}
                  required
                  {...form.getInputProps("password")}
                />
                <TextInput
                  label={t("Email (optional)")}
                  placeholder="you@company.com"
                  {...form.getInputProps("email")}
                />
              </>
            )}

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={handleCancelFlow} disabled={loading}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleNextFromCredentials}
              loading={loading}
            >
              {t("Test & continue")}
            </Button>
          </Group>
        </Stack>
      )}

      {active === 1 && (
        <Stack>
          <Text size="sm" c="dimmed">
            {t(
              "Choose the spaces to import. Users, groups and permissions will be imported for the selected spaces.",
            )}
          </Text>

          <Checkbox
            label={t("Import all spaces ({{count}})", {
              count: spaces.length,
            })}
            checked={importAll}
            onChange={(e) => toggleAll(e.currentTarget.checked)}
          />

          <ScrollArea h={320} type="auto" offsetScrollbars>
            <Stack gap="xs">
              {spaces.map((space) => (
                <Checkbox
                  key={space.id}
                  label={
                    <Group gap={6} wrap="nowrap">
                      <Text fw={500}>{space.name}</Text>
                      <Text size="xs" c="dimmed">
                        ({space.key})
                      </Text>
                    </Group>
                  }
                  checked={importAll || selectedKeys.includes(space.key)}
                  disabled={importAll}
                  onChange={(e) =>
                    toggleSpace(space.key, e.currentTarget.checked)
                  }
                />
              ))}
              {spaces.length === 0 && (
                <Text c="dimmed" ta="center" py="lg">
                  {t("No spaces found for this account.")}
                </Text>
              )}
            </Stack>
          </ScrollArea>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          )}

          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t("{{count}} selected", { count: selectedCount })}
            </Text>
            <Group>
              <Button
                variant="default"
                onClick={() => setActive(0)}
                disabled={loading}
              >
                {t("Back")}
              </Button>
              <Button
                onClick={handleStartImport}
                loading={loading}
                disabled={!importAll && selectedKeys.length === 0}
              >
                {t("Start import")}
              </Button>
            </Group>
          </Group>
        </Stack>
      )}

    </Modal>
  );
}
