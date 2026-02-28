import { useState, useMemo } from "react";
import { Group, Select, Space } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import Paginate from "@/components/common/paginate";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import { useAuditLogsQuery } from "@/ee/audit/queries/audit-query";
import { IAuditLogParams } from "@/ee/audit/types/audit.types";
import { eventFilterOptions } from "@/ee/audit/lib/audit-event-labels";
import AuditLogsTable from "@/ee/audit/components/audit-logs-table";
import useUserRole from "@/hooks/use-user-role";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query";

const datePresets = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

function getStartDateFromPreset(preset: string | null): string | undefined {
  if (!preset || preset === "all") return undefined;
  const days = parseInt(preset, 10);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { cursor, goNext, goPrev, resetCursor } = useCursorPaginate();

  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [actorFilter, setActorFilter] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<string | null>("30");

  const { data: membersData } = useWorkspaceMembersQuery({ limit: 100 });

  const memberOptions = useMemo(() => {
    if (!membersData?.items) return [];
    return membersData.items.map((m) => ({
      value: m.id,
      label: m.name || m.email,
    }));
  }, [membersData]);

  const params: IAuditLogParams = useMemo(
    () => ({
      cursor,
      limit: 50,
      event: eventFilter ?? undefined,
      actorId: actorFilter ?? undefined,
      startDate: getStartDateFromPreset(datePreset),
    }),
    [cursor, eventFilter, actorFilter, datePreset],
  );

  const { data, isLoading } = useAuditLogsQuery(params);

  if (!isAdmin) {
    return null;
  }

  const handleEventChange = (value: string | null) => {
    setEventFilter(value);
    resetCursor();
  };

  const handleActorChange = (value: string | null) => {
    setActorFilter(value);
    resetCursor();
  };

  const handleDateChange = (value: string | null) => {
    setDatePreset(value);
    resetCursor();
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Audit log")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Audit log")} />

      <Group mb="md" gap="sm">
        <Select
          placeholder={t("Event")}
          data={eventFilterOptions.map((group) => ({
            group: t(group.group),
            items: group.items.map((item) => ({
              value: item.value,
              label: t(item.label),
            })),
          }))}
          value={eventFilter}
          onChange={handleEventChange}
          clearable
          searchable
          w={220}
          size="sm"
        />

        <Select
          placeholder={t("User")}
          data={memberOptions}
          value={actorFilter}
          onChange={handleActorChange}
          clearable
          searchable
          w={200}
          size="sm"
        />

        <Select
          data={datePresets.map((d) => ({
            value: d.value,
            label: t(d.label),
          }))}
          value={datePreset}
          onChange={handleDateChange}
          w={160}
          size="sm"
        />
      </Group>

      <AuditLogsTable items={data?.items} isLoading={isLoading} />

      <Space h="md" />

      {data?.items && data.items.length > 0 && (
        <Paginate
          hasPrevPage={data?.meta?.hasPrevPage}
          hasNextPage={data?.meta?.hasNextPage}
          onNext={() => goNext(data?.meta?.nextCursor)}
          onPrev={goPrev}
        />
      )}
    </>
  );
}
