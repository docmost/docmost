import { Fragment, useState } from "react";
import { Table, Text, Group, Skeleton, Anchor, Collapse, Box } from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  IconChevronRight,
  IconChevronDown,
  IconArrowRight,
} from "@tabler/icons-react";
import { IAuditLog } from "@/ee/audit/types/audit.types";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { getEventLabel } from "@/ee/audit/lib/audit-event-labels";
import { formattedDate } from "@/lib/time";
import NoTableResults from "@/components/common/no-table-results";
import classes from "./audit-logs.module.css";

type AuditLogsTableProps = {
  items?: IAuditLog[];
  isLoading: boolean;
};

function hasDetails(entry: IAuditLog): boolean {
  return !!(entry.changes?.before || entry.changes?.after || entry.metadata);
}

function getResourceUrl(entry: IAuditLog): string | null {
  if (!entry.resource) return null;

  switch (entry.resourceType) {
    case "group":
      return `/settings/groups/${entry.resource.id}`;
    case "space":
    case "space_member":
      return entry.resource.slug ? `/s/${entry.resource.slug}` : null;
    default:
      return null;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ChangesDiff({ changes }: { changes: IAuditLog["changes"] }) {
  const { t } = useTranslation();
  if (!changes) return null;

  const { before, after } = changes;
  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  if (allKeys.size === 0) return null;

  return (
    <Box>
      <Text fz="xs" fw={600} mb={4}>
        {t("Changes")}
      </Text>
      {[...allKeys].map((key) => {
        const hasBefore = before && key in before;
        const hasAfter = after && key in after;

        return (
          <Group key={key} gap={6} mb={2} wrap="nowrap" align="center">
            <Text fz="xs" c="dimmed" fw={500} style={{ minWidth: "fit-content" }}>
              {key}:
            </Text>
            {hasBefore && (
              <Text fz="xs" component="span">
                {formatValue(before[key])}
              </Text>
            )}
            {hasBefore && hasAfter && (
              <IconArrowRight size={10} color="var(--mantine-color-dimmed)" />
            )}
            {hasAfter && (
              <Text fz="xs" component="span">
                {formatValue(after[key])}
              </Text>
            )}
          </Group>
        );
      })}
    </Box>
  );
}

function MetadataDisplay({ metadata }: { metadata: Record<string, any> }) {
  const { t } = useTranslation();
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;

  return (
    <Box>
      <Text fz="xs" fw={600} mb={4}>
        {t("Metadata")}
      </Text>
      {entries.map(([key, value]) => (
        <Group key={key} gap={6} mb={2} wrap="nowrap">
          <Text fz="xs" c="dimmed" fw={500}>
            {key}:
          </Text>
          <Text fz="xs">{formatValue(value)}</Text>
        </Group>
      ))}
    </Box>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <Table.Tr key={i}>
          <Table.Td>
            <Group gap="sm" wrap="nowrap">
              <Skeleton circle height={36} />
              <div>
                <Skeleton height={14} width={120} mb={4} />
                <Skeleton height={10} width={160} />
              </div>
            </Group>
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={140} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={120} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={120} />
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

function ResourceCell({ entry }: { entry: IAuditLog }) {
  if (!entry.resource?.name) {
    return <Text fz="sm" c="dimmed">—</Text>;
  }

  const url = getResourceUrl(entry);

  if (url) {
    return (
      <Anchor
        size="sm"
        underline="never"
        style={{
          cursor: "pointer",
          color: "var(--mantine-color-text)",
        }}
        component={Link}
        to={url}
      >
        <div className={classes.resourceLinkText}>
          <Text fz="sm" fw={500} lineClamp={1}>
            {entry.resource.name}
          </Text>
        </div>
      </Anchor>
    );
  }

  return (
    <Text fz="sm" lineClamp={1}>
      {entry.resource.name}
    </Text>
  );
}

export default function AuditLogsTable({
  items,
  isLoading,
}: AuditLogsTableProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Table.ScrollContainer minWidth={700}>
      <Table highlightOnHover verticalSpacing="xs" className={classes.table}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Actor")}</Table.Th>
            <Table.Th>{t("Event")}</Table.Th>
            <Table.Th>{t("Resource")}</Table.Th>
            <Table.Th>{t("Date")}</Table.Th>
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {isLoading ? (
            <TableSkeleton />
          ) : items && items.length > 0 ? (
            items.map((entry) => {
              const expandable = hasDetails(entry);
              const isExpanded = expanded.has(entry.id);

              return (
                <Fragment key={entry.id}>
                  <Table.Tr
                    onClick={expandable ? () => toggleExpanded(entry.id) : undefined}
                    style={{ cursor: expandable ? "pointer" : undefined }}
                  >
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        {expandable ? (
                          isExpanded ? (
                            <IconChevronDown size={16} color="var(--mantine-color-dimmed)" />
                          ) : (
                            <IconChevronRight size={16} color="var(--mantine-color-dimmed)" />
                          )
                        ) : (
                          <Box w={16} />
                        )}
                        {entry.actor ? (
                          <Group gap="sm" wrap="nowrap">
                            <CustomAvatar
                              avatarUrl={entry.actor.avatarUrl}
                              name={entry.actor.name}
                              size={36}
                            />
                            <div>
                              <Text fz="sm" fw={500} lineClamp={1}>
                                {entry.actor.name}
                              </Text>
                              <Text fz="xs" c="dimmed">
                                {entry.actor.email}
                              </Text>
                            </div>
                          </Group>
                        ) : (
                          <Text fz="sm" c="dimmed" fs="italic">
                            {entry.actorType === "system"
                              ? t("System")
                              : t("API key")}
                          </Text>
                        )}
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Text fz="sm">{t(getEventLabel(entry.event))}</Text>
                    </Table.Td>

                    <Table.Td>
                      <ResourceCell entry={entry} />
                    </Table.Td>

                    <Table.Td>
                      <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                        {formattedDate(new Date(entry.createdAt))}
                      </Text>
                    </Table.Td>
                  </Table.Tr>

                  {expandable && (
                    <Table.Tr
                      className={classes.detailRow}
                    >
                      <Table.Td colSpan={4} p={0}>
                        <Collapse in={isExpanded}>
                          <Box px="md" py="sm" className={classes.detailContent}>
                            <Group gap="xl" align="flex-start">
                              {entry.changes && <ChangesDiff changes={entry.changes} />}
                              {entry.metadata && <MetadataDisplay metadata={entry.metadata} />}
                            </Group>
                          </Box>
                        </Collapse>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Fragment>
              );
            })
          ) : (
            <NoTableResults colSpan={4} />
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
