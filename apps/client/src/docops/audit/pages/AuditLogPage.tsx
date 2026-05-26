import { useState } from "react";
import {
  Badge,
  Button,
  Container,
  Group,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput, type DatesRangeValue } from "@mantine/dates";
import { IconDownload, IconSearch } from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useDebouncedValue } from "@mantine/hooks";
import { useAuditLogsQuery } from "../hooks/useAuditLogs";
import type { AuditLog } from "../api/audit.api";
import { getAppName } from "@/lib/config";

const PAGE_SIZE = 50;

function exportToCsv(rows: AuditLog[]) {
  const headers = ["id", "actor_id", "action", "entity_kind", "entity_id", "ip", "user_agent", "created_at"];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const val = (r as any)[h] ?? "";
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogPage() {
  const [action, setAction] = useState("");
  const [entityKind, setEntityKind] = useState("");
  const [actorId, setActorId] = useState("");
  const [debouncedActorId] = useDebouncedValue(actorId, 400);
  const [dateRange, setDateRange] = useState<DatesRangeValue>([null, null]);
  const [page, setPage] = useState(1);

  const params = {
    action: action || undefined,
    entityKind: entityKind || undefined,
    actorId: debouncedActorId || undefined,
    from: dateRange[0] ? new Date(dateRange[0]).toISOString() : undefined,
    to: dateRange[1] ? new Date(dateRange[1]).toISOString() : undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const { data, isLoading, isError } = useAuditLogsQuery(params);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const ENTITY_KIND_OPTIONS = [
    { value: "", label: "Tutti" },
    { value: "change_request", label: "Change Request" },
    { value: "service", label: "Servizio" },
    { value: "webhook_config", label: "Webhook" },
  ];

  return (
    <>
      <Helmet>
        <title>Audit Log — {getAppName()}</title>
      </Helmet>
      <Container size="xl" py="xl">
        <Group justify="space-between" mb="lg">
          <Title order={2}>Audit Log</Title>
          <Button
            leftSection={<IconDownload size={16} />}
            variant="outline"
            disabled={!data?.items.length}
            onClick={() => data && exportToCsv(data.items)}
          >
            Esporta CSV
          </Button>
        </Group>

        <Paper withBorder p="md" mb="md">
          <Group gap="md" wrap="wrap">
            <TextInput
              placeholder="Actor ID (UUID)"
              leftSection={<IconSearch size={16} />}
              value={actorId}
              onChange={(e) => { setActorId(e.currentTarget.value); setPage(1); }}
              w={260}
            />
            <TextInput
              placeholder="Azione (es. cr.approve)"
              value={action}
              onChange={(e) => { setAction(e.currentTarget.value); setPage(1); }}
              w={220}
            />
            <Select
              placeholder="Tipo entità"
              data={ENTITY_KIND_OPTIONS}
              value={entityKind}
              onChange={(v) => { setEntityKind(v ?? ""); setPage(1); }}
              w={180}
            />
            <DatePickerInput
              type="range"
              placeholder="Intervallo date"
              value={dateRange}
              onChange={(v) => { setDateRange(v); setPage(1); }}
              w={260}
              clearable
            />
          </Group>
        </Paper>

        {isError && (
          <Text c="red" mb="md">Errore nel caricamento dei log.</Text>
        )}

        <Paper withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Data</Table.Th>
                <Table.Th>Actor ID</Table.Th>
                <Table.Th>Azione</Table.Th>
                <Table.Th>Entità</Table.Th>
                <Table.Th>Entity ID</Table.Th>
                <Table.Th>IP</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" py="xl" c="dimmed">Caricamento…</Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {!isLoading && !data?.items.length && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" py="xl" c="dimmed">Nessun log trovato.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {data?.items.map((log) => (
                <Table.Tr key={log.id}>
                  <Table.Td>
                    <Tooltip label={log.created_at}>
                      <Text size="sm">
                        {new Date(log.created_at).toLocaleString("it-IT")}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" c="dimmed">
                      {log.actor_id ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {log.action}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{log.entity_kind}</Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" c="dimmed">
                      {log.entity_id}
                    </Text>
                  </Table.Td>
                  <Table.Td>{log.ip ?? "—"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}

        <Stack mt="xs">
          <Text size="xs" c="dimmed">
            {data ? `${data.total} log totali` : ""}
          </Text>
        </Stack>
      </Container>
    </>
  );
}
