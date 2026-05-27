import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Helmet } from "react-helmet-async";
import { IconAlertCircle, IconPlus, IconSearch } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useChangeRequestsQuery } from "../hooks/useChangeRequests";
import { CRStateBadge } from "../components/CRStateBadge";
import type { CrPriority, CrStatus } from "../types/cr.types";
import { getAppName } from "@/lib/config";

const PAGE_SIZE = 20;

const PRIORITY_COLORS: Record<CrPriority, string> = {
  LOW: "gray",
  MEDIUM: "blue",
  HIGH: "orange",
  CRITICAL: "red",
};

export default function ChangeRequestsListPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [status, setStatus] = useState<CrStatus | "">("");
  const [priority, setPriority] = useState<CrPriority | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useChangeRequestsQuery({
    search: debouncedSearch || undefined,
    status: (status as CrStatus) || undefined,
    priority: (priority as CrPriority) || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <>
      <Helmet>
        <title>{t("Change Requests")} — {getAppName()}</title>
      </Helmet>

      <Container size="1000" pt="xl">
        <Group justify="space-between" mb="lg">
          <Title order={2}>{t("Change Requests")}</Title>
          <Button
            component={Link}
            to="/change-requests/new"
            leftSection={<IconPlus size={14} />}
            aria-label={t("New Change Request")}
          >
            {t("New Change Request")}
          </Button>
        </Group>

        <Paper withBorder p="md" radius="md" mb="md">
          <Group gap="sm" wrap="wrap">
            <TextInput
              flex={1}
              placeholder={t("Search change requests...")}
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
              aria-label={t("Search change requests...")}
            />
            <Select
              w={160}
              placeholder={t("All statuses")}
              clearable
              data={[
                "IN_REVIEW", "IN_VERIFICATION", "IN_PROGRESS", "PUBLISHED", "CLOSED",
              ].map((s) => ({ value: s, label: t(s) }))}
              value={status}
              onChange={(v) => { setStatus((v as CrStatus) ?? ""); setPage(1); }}
              aria-label={t("Filter by status")}
            />
            <Select
              w={140}
              placeholder={t("All priorities")}
              clearable
              data={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => ({
                value: p,
                label: t(p),
              }))}
              value={priority}
              onChange={(v) => { setPriority((v as CrPriority) ?? ""); setPage(1); }}
              aria-label={t("Filter by priority")}
            />
          </Group>
        </Paper>

        {isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {t("Failed to load change requests.")}
          </Alert>
        )}

        {isLoading ? (
          <Stack gap="xs">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={48} radius="sm" />
            ))}
          </Stack>
        ) : !data?.items.length ? (
          <Text c="dimmed" ta="center" py="xl">
            {t("No change requests found")}
          </Text>
        ) : (
          <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("Title")}</Table.Th>
                  <Table.Th>{t("Status")}</Table.Th>
                  <Table.Th>{t("Priority")}</Table.Th>
                  <Table.Th>{t("Created")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.items.map((cr) => (
                  <Table.Tr key={cr.id}>
                    <Table.Td>
                      <Text
                        component={Link}
                        to={`/change-requests/${cr.id}`}
                        size="sm"
                        fw={500}
                        c="blue"
                        style={{ textDecoration: "none" }}
                      >
                        {cr.title}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <CRStateBadge status={cr.status} />
                    </Table.Td>
                    <Table.Td>
                      <Badge color={PRIORITY_COLORS[cr.priority]} variant="light" size="sm">
                        {t(cr.priority)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {cr.createdAt ? new Date(cr.createdAt).toLocaleDateString() : "—"}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}

        {totalPages > 1 && (
          <Group justify="center" mt="lg">
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
              aria-label={t("Change requests pagination")}
            />
          </Group>
        )}
      </Container>
    </>
  );
}
