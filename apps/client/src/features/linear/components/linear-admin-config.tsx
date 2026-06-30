import { useEffect, useState } from "react";
import {
  Button,
  Code,
  Group,
  List,
  Loader,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useDeleteLinearConfigMutation,
  useLinearConfigQuery,
  useSetLinearConfigMutation,
} from "../queries/linear-query";

interface LinearAdminConfigProps {
  opened: boolean;
  onClose: () => void;
}

export default function LinearAdminConfig({
  opened,
  onClose,
}: LinearAdminConfigProps) {
  const { t } = useTranslation();
  const { data: config, isError } = useLinearConfigQuery(opened);
  const setMutation = useSetLinearConfigMutation();
  const deleteMutation = useDeleteLinearConfigMutation();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // mirror the stored client id: populate on load, clear after a removal, and
  // discard any unsaved edit when the modal is reopened
  useEffect(() => {
    setClientId(config?.clientId ?? "");
  }, [config?.clientId, opened]);

  // never carry a typed secret across opens
  useEffect(() => {
    if (!opened) setClientSecret("");
  }, [opened]);

  const configured = config?.configured;

  const handleSave = () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setMutation.mutate(
      { clientId: clientId.trim(), clientSecret: clientSecret.trim() },
      {
        onSuccess: () => {
          setClientSecret("");
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Configure Linear")}
      size="lg"
    >
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {t(
            "Connect this workspace to Linear so members can mention, preview, search, and create Linear issues in pages. After setup, each member connects their own Linear account and only sees issues their Linear permissions allow.",
          )}
        </Text>
        <List size="sm" c="dimmed" type="ordered" spacing={6}>
          <List.Item>
            {t(
              "In Linear, open Settings → API → OAuth applications → Create new application.",
            )}
          </List.Item>
          <List.Item>
            {t('Under "Redirect URIs", add exactly this URL:')}{" "}
            {config?.redirectUri ? (
              <Code>{config.redirectUri}</Code>
            ) : isError ? (
              <Text span size="sm" c="red">
                {t("Couldn't load the callback URL. Reopen to retry.")}
              </Text>
            ) : (
              <Loader size="xs" />
            )}
          </List.Item>
          <List.Item>
            {t(
              "Leave Public, Client credentials, and Webhooks turned off, and leave GitHub username blank. Docmost uses the per-user authorization flow (actor=user), not the client_credentials grant, and does not use webhooks.",
            )}
          </List.Item>
          <List.Item>
            {t(
              "Create the application, then copy its Client ID and Client secret into the fields below.",
            )}
          </List.Item>
        </List>

        <TextInput
          label={t("Client ID")}
          value={clientId}
          onChange={(event) => setClientId(event.currentTarget.value)}
        />
        <PasswordInput
          label={t("Client secret")}
          placeholder={
            configured ? t("Stored. Enter a new value to replace it.") : ""
          }
          value={clientSecret}
          onChange={(event) => setClientSecret(event.currentTarget.value)}
        />

        <Group justify="flex-end">
          {configured && (
            <Button
              variant="default"
              color="red"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {t("Remove")}
            </Button>
          )}
          <Button
            loading={setMutation.isPending}
            disabled={!clientId.trim() || !clientSecret.trim()}
            onClick={handleSave}
          >
            {t("Save")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
