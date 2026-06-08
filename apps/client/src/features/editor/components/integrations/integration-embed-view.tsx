import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Popover,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { IconAlertCircle, IconEdit, IconRefresh } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useResolveIntegrationResourceQuery,
  useSearchIntegrationResourceQuery,
} from "@/features/integrations/queries/integration-resource-query";
import {
  IntegrationItemCardPayload,
  IntegrationResourceSearchResult,
  IntegrationTableReportPayload,
  IntegrationTableReportRow,
  resolveIntegrationResource,
} from "@/features/integrations/services/integration-resource-service";
import { findRegisteredIntegrationResource } from "@/features/integrations/integration-resource-registry";
import classes from "./integration-embed-view.module.css";

interface IntegrationEmbedAttrs {
  integrationId?: string;
  resourceId?: string;
  resourceKey?: string;
  labelAtInsert?: string;
  renderKind?: string;
  params?: Record<string, unknown> | null;
}

export default function IntegrationEmbedView(props: NodeViewProps) {
  const attrs = props.node.attrs as IntegrationEmbedAttrs;
  const integrationId = attrs.integrationId ?? "";
  const resourceId = attrs.resourceId ?? "";
  const manifest = findRegisteredIntegrationResource(integrationId, resourceId);

  if (!integrationId || !resourceId) {
    return <Unavailable message="Integration resource is not configured" />;
  }

  if (!attrs.resourceKey) {
    if (!props.editor.isEditable) {
      return <Unavailable message="Integration embed is not configured" />;
    }
    return (
      <EmptyState
        integrationId={integrationId}
        resourceId={resourceId}
        title={manifest?.title ?? "Integration embed"}
        placeholder={manifest?.picker?.placeholder}
        emptyLabel={manifest?.picker?.emptyLabel}
        searchOnEmpty={manifest?.picker?.searchOnEmpty}
        renderKind={manifest?.renderKind ?? attrs.renderKind}
        updateAttributes={props.updateAttributes}
      />
    );
  }

  return (
    <ResolvedState
      integrationId={integrationId}
      resourceId={resourceId}
      resourceKey={attrs.resourceKey}
      labelAtInsert={attrs.labelAtInsert}
      params={attrs.params}
      renderKind={manifest?.renderKind ?? attrs.renderKind}
      editable={props.editor.isEditable}
      updateAttributes={props.updateAttributes}
    />
  );
}

function ResourcePickerForm(props: {
  integrationId: string;
  resourceId: string;
  placeholder?: string;
  emptyLabel?: string;
  searchOnEmpty?: boolean;
  onPick: (result: IntegrationResourceSearchResult) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(value.trim(), 200);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useSearchIntegrationResourceQuery({
    integrationId: props.integrationId,
    resourceId: props.resourceId,
    q: debouncedQuery,
    searchOnEmpty: props.searchOnEmpty,
  });

  // Focus without scrolling: a native autoFocus fires while a portalled
  // popover is still unpositioned, yanking the viewport to the top.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const first = search.data?.[0];
    if (first) props.onPick(first);
  };

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="xs">
        <TextInput
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          placeholder={props.placeholder ?? t("Search…")}
          rightSection={search.isFetching ? <Loader size="xs" /> : null}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit(e);
          }}
        />
        <SearchResultList
          results={search.data ?? []}
          isLoading={search.isFetching && !search.data}
          query={debouncedQuery}
          searchOnEmpty={props.searchOnEmpty}
          emptyLabel={props.emptyLabel}
          onPick={props.onPick}
        />
      </Stack>
    </form>
  );
}

function EmptyState(props: {
  integrationId: string;
  resourceId: string;
  title: string;
  placeholder?: string;
  emptyLabel?: string;
  searchOnEmpty?: boolean;
  renderKind?: string;
  updateAttributes: NodeViewProps["updateAttributes"];
}) {
  const { t } = useTranslation();
  return (
    <NodeViewWrapper>
      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t("Embed {{title}}", { title: props.title })}
          </Text>
          <ResourcePickerForm
            integrationId={props.integrationId}
            resourceId={props.resourceId}
            placeholder={props.placeholder}
            emptyLabel={props.emptyLabel}
            searchOnEmpty={props.searchOnEmpty}
            onPick={(result) =>
              props.updateAttributes({
                resourceKey: result.key,
                labelAtInsert: result.title,
                renderKind: props.renderKind,
                params: null,
              })
            }
          />
        </Stack>
      </Card>
    </NodeViewWrapper>
  );
}

/** Edit-pencil popover to retarget a placed embed — mirrors the stock embed
    component's edit affordance. */
function EditResourceControl(props: {
  integrationId: string;
  resourceId: string;
  updateAttributes: NodeViewProps["updateAttributes"];
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const manifest = findRegisteredIntegrationResource(props.integrationId, props.resourceId);
  return (
    <Popover opened={opened} onChange={setOpened} width={320} position="bottom-end" withArrow hideDetached={false}>
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          onClick={() => setOpened(true)}
          aria-label={t("Change linked resource")}
        >
          <IconEdit size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <ResourcePickerForm
          integrationId={props.integrationId}
          resourceId={props.resourceId}
          placeholder={manifest?.picker?.placeholder}
          emptyLabel={manifest?.picker?.emptyLabel}
          searchOnEmpty={manifest?.picker?.searchOnEmpty}
          onPick={(result) => {
            props.updateAttributes({
              resourceKey: result.key,
              labelAtInsert: result.title,
              params: null,
            });
            setOpened(false);
          }}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

function SearchResultList(props: {
  results: IntegrationResourceSearchResult[];
  isLoading: boolean;
  query: string;
  searchOnEmpty?: boolean;
  emptyLabel?: string;
  onPick: (result: IntegrationResourceSearchResult) => void;
}) {
  const { t } = useTranslation();
  if (!props.searchOnEmpty && props.query.length === 0) return null;
  if (props.isLoading) {
    return (
      <Text size="xs" c="dimmed">
        {t("Searching…")}
      </Text>
    );
  }
  if (props.results.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        {props.emptyLabel ? t(props.emptyLabel) : t("No matching resources")}
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      {props.results.map((result) => (
        <UnstyledButton
          key={result.key}
          onClick={() => props.onPick(result)}
          style={{ padding: "6px 8px", borderRadius: 4, display: "block", width: "100%" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <Group gap="xs" wrap="nowrap">
            {result.badge && (
              <Badge color="blue" variant="filled" size="sm">
                {result.badge}
              </Badge>
            )}
            <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
              {result.title}
            </Text>
            {result.subtitle && (
              <Badge variant="default" size="xs">
                {result.subtitle}
              </Badge>
            )}
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );
}

function ResolvedState(props: {
  integrationId: string;
  resourceId: string;
  resourceKey: string;
  labelAtInsert?: string;
  params?: Record<string, unknown> | null;
  renderKind?: string;
  editable?: boolean;
  updateAttributes: NodeViewProps["updateAttributes"];
}) {
  const { t } = useTranslation();
  const query = useResolveIntegrationResourceQuery({
    integrationId: props.integrationId,
    resourceId: props.resourceId,
    resourceKey: props.resourceKey,
    params: props.params,
  });

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") query.refetch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query.data?.kind === "item-card" && query.data.key && query.data.key !== props.resourceKey) {
      props.updateAttributes({ resourceKey: query.data.key, labelAtInsert: query.data.title, params: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  if (query.isLoading) {
    if (props.renderKind === "table-report") {
      return (
        <NodeViewWrapper>
          <Card withBorder padding="md" radius="md">
            <Skeleton height={20} width="40%" mb="sm" />
            <Stack gap={6}>
              <Skeleton height={28} />
              <Skeleton height={28} />
              <Skeleton height={28} />
            </Stack>
          </Card>
        </NodeViewWrapper>
      );
    }
    return (
      <NodeViewWrapper>
        <Card withBorder padding="md" radius="md">
          <Skeleton height={20} width="60%" mb="xs" />
          <Skeleton height={14} width="40%" />
        </Card>
      </NodeViewWrapper>
    );
  }

  if (query.isError) {
    return <ErrorState error={query.error} fallbackLabel={props.labelAtInsert || props.resourceKey} refetch={() => query.refetch()} />;
  }

  const editControl = props.editable ? (
    <EditResourceControl
      integrationId={props.integrationId}
      resourceId={props.resourceId}
      updateAttributes={props.updateAttributes}
    />
  ) : null;

  if (query.data?.kind === "item-card") {
    return (
      <ItemCard
        payload={query.data}
        refetch={() => query.refetch()}
        isFetching={query.isFetching}
        editControl={editControl}
      />
    );
  }
  if (query.data?.kind === "table-report") {
    return (
      <TableReport
        payload={query.data}
        integrationId={props.integrationId}
        resourceId={props.resourceId}
        resourceKey={props.resourceKey}
        dataUpdatedAt={query.dataUpdatedAt}
        refetch={() => query.refetch()}
        isFetching={query.isFetching}
        editControl={editControl}
      />
    );
  }
  return <Unavailable message={t("Unsupported integration resource")} />;
}

function ErrorState(props: { error: Error; fallbackLabel: string; refetch: () => void }) {
  const { t } = useTranslation();
  const status = (props.error as Error & { response?: { status?: number; data?: { code?: string } } })?.response?.status;
  const code = (props.error as Error & { response?: { data?: { code?: string } } })?.response?.data?.code;

  if (status === 409 && (code === "INTEGRATION_NOT_CONNECTED" || code === "INTEGRATION_RECONNECT_REQUIRED")) {
    return (
      <NodeViewWrapper>
        <Card withBorder padding="md" radius="md">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {code === "INTEGRATION_NOT_CONNECTED"
                ? t("Integration not connected")
                : t("Reconnect integration to refresh")}
            </Text>
            <Anchor component={Link} to="/settings/account/integrations" size="sm">
              {t("Connect integration")}
            </Anchor>
          </Group>
        </Card>
      </NodeViewWrapper>
    );
  }

  if (status && status >= 400 && status < 500) {
    return (
      <NodeViewWrapper>
        <Card withBorder padding="md" radius="md">
          <Group gap="xs">
            <Badge color="gray" variant="light">
              {props.fallbackLabel}
            </Badge>
            <Text size="sm" c="dimmed">
              {t("Resource unavailable")}
            </Text>
          </Group>
        </Card>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <Card withBorder padding="md" radius="md">
        <Group gap="xs">
          <IconAlertCircle size={16} />
          <Text size="sm">{t("Failed to load")}</Text>
          <ActionIcon variant="subtle" onClick={props.refetch} aria-label={t("Refresh")}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>
      </Card>
    </NodeViewWrapper>
  );
}

function ItemCard(props: {
  payload: IntegrationItemCardPayload;
  refetch: () => void;
  isFetching: boolean;
  editControl?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <NodeViewWrapper>
      <Card withBorder padding="sm" radius="md">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            {props.payload.url ? (
              <Badge component="a" href={props.payload.url} target="_blank" rel="noreferrer" color="blue" variant="filled" size="sm" className={classes.badgeLink}>
                {props.payload.key}
              </Badge>
            ) : (
              <Badge color="blue" variant="filled" size="sm">{props.payload.key}</Badge>
            )}
            {props.payload.url ? (
              <Text component="a" href={props.payload.url} target="_blank" rel="noreferrer" size="sm" fw={500} truncate className={classes.quietLink} style={{ minWidth: 0 }}>
                {props.payload.title}
              </Text>
            ) : (
              <Text size="sm" fw={500} truncate style={{ minWidth: 0 }}>
                {props.payload.title}
              </Text>
            )}
            {props.payload.assignee && (
              <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                {props.payload.assignee}
              </Text>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            {props.payload.priority && (
              <Badge variant="default" size="sm">
                {props.payload.priority}
              </Badge>
            )}
            {props.payload.status && (
              <Badge variant="light" size="sm">
                {props.payload.status}
              </Badge>
            )}
            <Group gap={4} wrap="nowrap">
              {props.editControl}
              <ActionIcon variant="subtle" onClick={props.refetch} aria-label={t("Refresh")} loading={props.isFetching}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </Group>
      </Card>
    </NodeViewWrapper>
  );
}

function TableReport(props: {
  payload: IntegrationTableReportPayload;
  integrationId: string;
  resourceId: string;
  resourceKey: string;
  dataUpdatedAt: number;
  refetch: () => void;
  isFetching: boolean;
  editControl?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [extraRows, setExtraRows] = useState<IntegrationTableReportRow[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  // A fresh base payload (initial load or the refresh button) restarts paging.
  useEffect(() => {
    setExtraRows([]);
    setLoadingMore(false);
    setLoadMoreFailed(false);
    setNextPage(props.payload.hasMore ? (props.payload.page ?? 1) + 1 : null);
  }, [props.dataUpdatedAt]);

  const rows = [...props.payload.rows, ...extraRows];

  const loadMore = async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const result = await resolveIntegrationResource({
        integrationId: props.integrationId,
        resourceId: props.resourceId,
        resourceKey: props.resourceKey,
        params: { page: nextPage },
      });
      if (result.kind !== "table-report") {
        setNextPage(null);
        return;
      }
      // Concurrent edits can shift rows between pages; drop ids already shown.
      setExtraRows((prev) => {
        const seen = new Set([...props.payload.rows, ...prev].map((r) => r.id));
        return [...prev, ...result.rows.filter((r) => !seen.has(r.id))];
      });
      setNextPage(result.hasMore ? (result.page ?? nextPage) + 1 : null);
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <NodeViewWrapper>
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" mb="sm">
          <Stack gap={2}>
            <Text fw={600}>{props.payload.title}</Text>
            {props.payload.description && (
              <Text size="xs" c="dimmed">{props.payload.description}</Text>
            )}
          </Stack>
          <Group gap={4}>
            {props.payload.total != null && <Badge variant="default" size="sm">{t("{{ n }} items", { n: props.payload.total })}</Badge>}
            {props.editControl}
            <ActionIcon variant="subtle" onClick={props.refetch} loading={props.isFetching} aria-label={t("Refresh")}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>
        {rows.length === 0 ? (
          <Text size="sm" c="dimmed">{t("No rows to display.")}</Text>
        ) : (
          <Table withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Key")}</Table.Th>
                <Table.Th>{t("Title")}</Table.Th>
                <Table.Th>{t("Status")}</Table.Th>
                <Table.Th>{t("Assignee")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    {row.key && row.url ? (
                      <Tooltip label={t("Open")} withArrow openDelay={300}>
                        <Badge component="a" href={row.url} target="_blank" rel="noreferrer" color="blue" variant="filled" size="sm" className={classes.badgeLink}>
                          {row.key}
                        </Badge>
                      </Tooltip>
                    ) : row.key ? (
                      <Badge color="blue" variant="filled" size="sm">{row.key}</Badge>
                    ) : (
                      "—"
                    )}
                  </Table.Td>
                  <Table.Td>
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noreferrer" className={classes.quietLink}>{row.title}</a>
                    ) : (
                      row.title
                    )}
                  </Table.Td>
                  <Table.Td>{row.status ?? "—"}</Table.Td>
                  <Table.Td>{row.assignee ?? "—"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {(nextPage || props.payload.total != null) && rows.length > 0 && (
          <Group justify="space-between" mt="sm">
            <Text size="xs" c="dimmed">
              {props.payload.total != null
                ? t("Showing {{ shown }} of {{ total }}", { shown: rows.length, total: props.payload.total })
                : null}
            </Text>
            <Group gap="xs">
              {loadMoreFailed && (
                <Text size="xs" c="red">{t("Failed to load more rows")}</Text>
              )}
              {nextPage && (
                <Button variant="default" size="compact-xs" onClick={loadMore} loading={loadingMore}>
                  {t("Load more")}
                </Button>
              )}
            </Group>
          </Group>
        )}
      </Card>
    </NodeViewWrapper>
  );
}

function Unavailable(props: { message: string }) {
  return (
    <NodeViewWrapper>
      <Card withBorder padding="md" radius="md">
        <Text size="sm" c="dimmed">{props.message}</Text>
      </Card>
    </NodeViewWrapper>
  );
}
