import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Container,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconTrash, IconEdit } from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useForm } from "@mantine/form";
import {
  useWebhooksQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useDeleteWebhookMutation,
} from "../hooks/useWebhooks";
import type { WebhookConfig, CreateWebhookPayload } from "../api/webhooks.api";
import { getAppName } from "@/lib/config";

const CR_EVENTS = [
  { value: "cr.created", label: "CR Creata" },
  { value: "cr.approved", label: "CR Approvata" },
  { value: "cr.rejected", label: "CR Rifiutata" },
  { value: "cr.in_verification", label: "CR In Verifica" },
  { value: "cr.published", label: "CR Pubblicata" },
  { value: "cr.cancelled", label: "CR Cancellata" },
  { value: "cr.closed", label: "CR Chiusa" },
];

interface WebhookFormValues {
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
}

function WebhookForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initial?: Partial<WebhookFormValues>;
  onSubmit: (values: WebhookFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const form = useForm<WebhookFormValues>({
    initialValues: {
      name: initial?.name ?? "",
      url: initial?.url ?? "",
      secret: initial?.secret ?? "",
      events: initial?.events ?? [],
      isActive: initial?.isActive ?? true,
    },
    validate: {
      name: (v) => (v.trim() ? null : "Nome obbligatorio"),
      url: (v) => {
        try { new URL(v); return null; } catch { return "URL non valido"; }
      },
      secret: (v) => (v.length >= 16 ? null : "Secret minimo 16 caratteri"),
      events: (v) => (v.length ? null : "Seleziona almeno un evento"),
    },
  });

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack>
        <TextInput label="Nome" placeholder="es. Jira integration" {...form.getInputProps("name")} />
        <TextInput label="URL" placeholder="https://hooks.example.com/..." {...form.getInputProps("url")} />
        <TextInput
          label="Secret (≥16 caratteri)"
          placeholder="chiave segreta per firma HMAC"
          {...form.getInputProps("secret")}
        />
        <MultiSelect
          label="Eventi"
          data={CR_EVENTS}
          placeholder="Seleziona eventi"
          {...form.getInputProps("events")}
        />
        <Checkbox
          label="Attivo"
          {...form.getInputProps("isActive", { type: "checkbox" })}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>Annulla</Button>
          <Button type="submit" loading={isLoading}>Salva</Button>
        </Group>
      </Stack>
    </form>
  );
}

export default function WebhooksAdminPage() {
  const { data: webhooks, isLoading, isError } = useWebhooksQuery();
  const createMutation = useCreateWebhookMutation();
  const updateMutation = useUpdateWebhookMutation();
  const deleteMutation = useDeleteWebhookMutation();

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editTarget, setEditTarget] = useState<WebhookConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookConfig | null>(null);

  const handleCreate = (values: WebhookFormValues) => {
    createMutation.mutate(values as CreateWebhookPayload, { onSuccess: closeCreate });
  };

  const handleEdit = (values: WebhookFormValues) => {
    if (!editTarget) return;
    updateMutation.mutate(
      { id: editTarget.id, ...values },
      { onSuccess: () => setEditTarget(null) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const handleToggle = (wh: WebhookConfig) => {
    updateMutation.mutate({ id: wh.id, isActive: !wh.is_active });
  };

  return (
    <>
      <Helmet>
        <title>Webhook — {getAppName()}</title>
      </Helmet>
      <Container size="lg" py="xl">
        <Group justify="space-between" mb="lg">
          <Title order={2}>Webhook Outbound</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Nuovo webhook
          </Button>
        </Group>

        {isError && <Text c="red">Errore nel caricamento dei webhook.</Text>}

        <Paper withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>URL</Table.Th>
                <Table.Th>Eventi</Table.Th>
                <Table.Th>Attivo</Table.Th>
                <Table.Th>Azioni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" py="xl" c="dimmed">Caricamento…</Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {!isLoading && !webhooks?.length && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" py="xl" c="dimmed">Nessun webhook configurato.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {webhooks?.map((wh) => (
                <Table.Tr key={wh.id}>
                  <Table.Td>{wh.name}</Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" truncate maw={260}>
                      {wh.url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {wh.events.map((ev) => (
                        <Badge key={ev} size="xs" variant="light">{ev}</Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={wh.is_active}
                      onChange={() => handleToggle(wh)}
                      disabled={updateMutation.isPending}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Modifica">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => setEditTarget(wh)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Elimina">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteTarget(wh)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Container>

      <Modal opened={createOpened} onClose={closeCreate} title="Nuovo Webhook">
        <WebhookForm
          onSubmit={handleCreate}
          onCancel={closeCreate}
          isLoading={createMutation.isPending}
        />
      </Modal>

      <Modal
        opened={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Modifica Webhook"
      >
        {editTarget && (
          <WebhookForm
            initial={{
              name: editTarget.name,
              url: editTarget.url,
              secret: "",
              events: editTarget.events,
              isActive: editTarget.is_active,
            }}
            onSubmit={handleEdit}
            onCancel={() => setEditTarget(null)}
            isLoading={updateMutation.isPending}
          />
        )}
      </Modal>

      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Conferma eliminazione"
      >
        <Text mb="md">
          Eliminare il webhook <strong>{deleteTarget?.name}</strong>? L'operazione non può essere annullata.
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteTarget(null)}>Annulla</Button>
          <Button
            color="red"
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            Elimina
          </Button>
        </Group>
      </Modal>
    </>
  );
}
