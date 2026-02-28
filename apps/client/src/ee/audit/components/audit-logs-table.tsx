import { Table, Text, Group, Skeleton, Anchor } from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

function getResourceUrl(entry: IAuditLog): string | null {
  if (!entry.resource) return null;

  switch (entry.resourceType) {
    case "group":
      return `/settings/groups/${entry.resource.id}`;
    case "space":
      return entry.resource.slug ? `/s/${entry.resource.slug}` : null;
    default:
      return null;
  }
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

  return (
    <Table.ScrollContainer minWidth={700}>
      <Table highlightOnHover verticalSpacing="sm">
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
            items.map((entry) => (
              <Table.Tr key={entry.id}>
                <Table.Td>
                  {entry.actor ? (
                    <Group gap="sm" wrap="nowrap">
                      <CustomAvatar
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
            ))
          ) : (
            <NoTableResults colSpan={4} />
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
