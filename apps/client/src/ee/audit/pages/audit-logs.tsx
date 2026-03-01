import { useState, useMemo, useEffect } from "react";
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Popover,
  Select,
  Space,
  Text,
  Tooltip,
} from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { IconSettings } from "@tabler/icons-react";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import Paginate from "@/components/common/paginate";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import {
  useAuditLogsQuery,
  useAuditRetentionQuery,
  useUpdateAuditRetentionMutation,
} from "@/ee/audit/queries/audit-query";
import { IAuditLogParams } from "@/ee/audit/types/audit.types";
import { eventFilterOptions } from "@/ee/audit/lib/audit-event-labels";
import AuditLogsTable from "@/ee/audit/components/audit-logs-table";
import useUserRole from "@/hooks/use-user-role";

type RetentionUnit = "days" | "months" | "years";

function daysToRetention(days: number): { amount: number; unit: RetentionUnit } {
  if (days >= 365 && days % 365 === 0) {
    return { amount: days / 365, unit: "years" };
  }
  if (days >= 30 && days % 30 === 0) {
    return { amount: days / 30, unit: "months" };
  }
  return { amount: days, unit: "days" };
}

function retentionToDays(amount: number, unit: RetentionUnit): number {
  if (unit === "years") return amount * 365;
  if (unit === "months") return amount * 30;
  return amount;
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { cursor, goNext, goPrev, resetCursor } = useCursorPaginate();

  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: retentionData } = useAuditRetentionQuery();
  const updateRetention = useUpdateAuditRetentionMutation();

  const currentDays = retentionData?.retentionDays ?? 365;
  const parsed = daysToRetention(currentDays);
  const [retentionAmount, setRetentionAmount] = useState<number | string>(parsed.amount);
  const [retentionUnit, setRetentionUnit] = useState<RetentionUnit>(parsed.unit);

  useEffect(() => {
    if (retentionData) {
      const { amount, unit } = daysToRetention(retentionData.retentionDays);
      setRetentionAmount(amount);
      setRetentionUnit(unit);
    }
  }, [retentionData?.retentionDays]);

  const resetRetentionForm = () => {
    const { amount, unit } = daysToRetention(currentDays);
    setRetentionAmount(amount);
    setRetentionUnit(unit);
  };

  const params: IAuditLogParams = useMemo(
    () => ({
      cursor,
      limit: 50,
      event: eventFilter ?? undefined,
    }),
    [cursor, eventFilter],
  );

  const { data, isLoading } = useAuditLogsQuery(params);

  if (!isAdmin) {
    return null;
  }

  const handleEventChange = (value: string | null) => {
    setEventFilter(value);
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
          placeholder={t("Filter by event")}
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

        <Popover
          position="bottom-end"
          shadow="md"
          width={260}
          withArrow
          opened={settingsOpen}
          onChange={(opened) => {
            if (!opened) resetRetentionForm();
            setSettingsOpen(opened);
          }}
        >
          <Popover.Target>
            <Tooltip label={t("Audit settings")}>
              <ActionIcon variant="default" size="input-sm" ml="auto" onClick={() => setSettingsOpen((o) => !o)}>
                <IconSettings size={16} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <Text fz="sm" fw={500} mb={4}>
              {t("Retention")}
            </Text>
            <Text fz="xs" c="dimmed" mb="sm">
              {t("Logs older than this period are automatically deleted.")}
            </Text>
            <Group gap="xs" wrap="nowrap" mb="sm">
              <NumberInput
                value={retentionAmount}
                onChange={(val) => setRetentionAmount(val)}
                min={1}
                hideControls
                size="sm"
                w={60}
              />
              <Select
                data={[
                  { value: "days", label: t("days") },
                  { value: "months", label: t("months") },
                  { value: "years", label: t("years") },
                ]}
                value={retentionUnit}
                onChange={(value) => {
                  if (value === "days" || value === "months" || value === "years") {
                    setRetentionUnit(value);
                  }
                }}
                size="sm"
                style={{ flex: 1 }}
                comboboxProps={{ withinPortal: false }}
              />
            </Group>
            <Group gap="xs" grow>
              <Button
                size="xs"
                variant="default"
                onClick={() => {
                  resetRetentionForm();
                  setSettingsOpen(false);
                }}
              >
                {t("Cancel")}
              </Button>
              <Button
                size="xs"
                onClick={() => {
                  const num = typeof retentionAmount === "number" ? retentionAmount : 1;
                  const clamped = Math.max(1, num);
                  setRetentionAmount(clamped);
                  const days = retentionToDays(clamped, retentionUnit);
                  if (days !== currentDays) {
                    updateRetention.mutate({ auditRetentionDays: days });
                  }
                  setSettingsOpen(false);
                }}
                loading={updateRetention.isPending}
              >
                {t("Save")}
              </Button>
            </Group>
          </Popover.Dropdown>
        </Popover>
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
