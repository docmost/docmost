import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import Paginate from "@/components/common/paginate";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import {
  usePageAnalyticsRetentionQuery,
  useUpdatePageAnalyticsRetentionMutation,
  useWorkspacePageAnalyticsDailyStatsQuery,
  useWorkspacePageAnalyticsTopPagesQuery,
  useWorkspacePageAnalyticsTotalsQuery,
} from "@/ee/page-analytics/queries/page-analytics-query";
import { Link } from "react-router-dom";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import { IconSettings } from "@tabler/icons-react";
import {
  daysToRetention,
  formatNumber,
  retentionToDays,
  RetentionUnit,
  toISODate,
} from "@/ee/utils";

type RangePreset = "7" | "30" | "90";

const DAILY_PAGE_SIZE = 10;

export default function PageAnalytics() {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const [rangePreset, setRangePreset] = useState<RangePreset>("30");
  const [topPagesLimit, setTopPagesLimit] = useState("10");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: retentionData } = usePageAnalyticsRetentionQuery();
  const updateRetention = useUpdatePageAnalyticsRetentionMutation();

  const parsed = useMemo(
    () => daysToRetention(retentionData?.retentionDays ?? 365),
    [retentionData]
  );

  useEffect(() => {
    if (settingsOpen) return;

    setRetentionAmount(parsed.amount);
    setRetentionUnit(parsed.unit);
  }, [parsed]);

  const [retentionAmount, setRetentionAmount] = useState<number | string>(
    parsed.amount
  );
  const [retentionUnit, setRetentionUnit] = useState<RetentionUnit>(parsed.unit);

  const resetRetentionForm = useCallback(() => {
    const { amount, unit } = daysToRetention(retentionData?.retentionDays ?? 365);
    setRetentionAmount(amount);
    setRetentionUnit(unit);
  }, [setRetentionAmount, setRetentionUnit, retentionData]);

  const {
    cursor: topPagesCursor,
    goNext: goNextTopPages,
    goPrev: goPrevTopPages,
    resetCursor: resetTopPagesCursor,
  } = useCursorPaginate();

  const {
    cursor: dailyCursor,
    goNext: goNextDaily,
    goPrev: goPrevDaily,
    resetCursor: resetDailyCursor,
  } = useCursorPaginate();

  const dateRange = useMemo(
    () => ({
      startDate: toISODate(rangePreset),
      endDate: new Date().toISOString().slice(0, 10),
    }),
    [rangePreset]
  );

  const topPagesParams = useMemo(
    () => ({
      ...dateRange,
      cursor: topPagesCursor,
      limit: Number(topPagesLimit),
    }),
    [dateRange, topPagesCursor, topPagesLimit]
  );

  const formatDate = useCallback(
    (value?: Date | string | null) => {
      if (!value) return "-";

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";

      return formatLocalized(date, "MMM dd, yyyy", "PP", locale);
    },
    [locale]
  );

  const dailyParams = useMemo(
    () => ({
      ...dateRange,
      cursor: dailyCursor,
      limit: DAILY_PAGE_SIZE,
    }),
    [dateRange, dailyCursor]
  );

  const { data: totalsData } = useWorkspacePageAnalyticsTotalsQuery(dateRange);
  const { data: topPagesData, isLoading: isTopPagesLoading } =
    useWorkspacePageAnalyticsTopPagesQuery(topPagesParams);
  const { data: dailyData, isLoading: isDailyLoading } =
    useWorkspacePageAnalyticsDailyStatsQuery(dailyParams);

  const handleRangeChange = (value: RangePreset) => {
    if (value) {
      setRangePreset(value);
      resetTopPagesCursor();
      resetDailyCursor();
    }
  };

  const handleTopPagesLimitChange = (value: string | null) => {
    if (value) {
      setTopPagesLimit(value);
      resetTopPagesCursor();
    }
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Page analytics")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Page analytics")} />

      <Group justify="space-between" mb="md">
        <Select
          value={rangePreset}
          onChange={handleRangeChange}
          data={[
            { value: "7", label: t("Last 7 days") },
            { value: "30", label: t("Last 30 days") },
            { value: "90", label: t("Last 90 days") },
          ]}
          w={160}
          size="sm"
          allowDeselect={false}
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
              <ActionIcon
                variant="default"
                size="input-sm"
                ml="auto"
                onClick={() => setSettingsOpen((o) => !o)}
              >
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
                  const num =
                    typeof retentionAmount === "number" ? retentionAmount : 1;
                  const clamped = Math.max(1, num);
                  setRetentionAmount(clamped);
                  const days = retentionToDays(clamped, retentionUnit);

                  if (days !== (retentionData?.retentionDays ?? 365)) {
                    updateRetention.mutate({
                      pageAnalyticsRetentionDays: Number(days),
                    });
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

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed">
            {t("Total views")}
          </Text>
          <Text fw={700} fz="xl">
            {formatNumber(totalsData?.totals.totalViews)}
          </Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed">
            {t("Unique visitors")}
          </Text>
          <Text fw={700} fz="xl">
            {formatNumber(totalsData?.totals.uniqueVisitors)}
          </Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed">
            {t("Authenticated visitors")}
          </Text>
          <Text fw={700} fz="xl">
            {formatNumber(totalsData?.totals.authenticatedVisitors)}
          </Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed">
            {t("Shared-link views")}
          </Text>
          <Text fw={700} fz="xl">
            {formatNumber(totalsData?.totals.sharedViews)}
          </Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>{t("Top pages")}</Text>
            <Group gap="xs">
              {isTopPagesLoading && <Badge variant="light">{t("Loading")}</Badge>}
              <Select
                aria-label={t("Number of top pages")}
                data={[
                  { value: "10", label: t("Top 10") },
                  { value: "20", label: t("Top 20") },
                  { value: "50", label: t("Top 50") },
                  { value: "100", label: t("Top 100") },
                ]}
                value={topPagesLimit}
                onChange={handleTopPagesLimitChange}
                w={100}
                size="xs"
                allowDeselect={false}
              />
            </Group>
          </Group>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Page")}</Table.Th>
                <Table.Th>{t("Views")}</Table.Th>
                <Table.Th>{t("Visitors")}</Table.Th>
                <Table.Th>{t("Last viewed")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(topPagesData?.items ?? []).map((item) => (
                <Table.Tr key={item.pageId}>
                  <Table.Td>
                    {item.pageSlugId ? (
                      <Link to={`/p/${item.pageSlugId}`}>
                        {item.pageTitle || t("Untitled")}
                      </Link>
                    ) : (
                      item.pageTitle || t("Untitled")
                    )}
                  </Table.Td>
                  <Table.Td>{formatNumber(item.totalViews)}</Table.Td>
                  <Table.Td>{formatNumber(item.uniqueVisitors)}</Table.Td>
                  <Table.Td>{formatDate(item.lastViewedAt)}</Table.Td>
                </Table.Tr>
              ))}
              {!isTopPagesLoading && (topPagesData?.items.length ?? 0) === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" size="sm">
                      {t("No analytics data for this range.")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          {topPagesData?.items &&
            topPagesData.items.length > 0 &&
            (topPagesData.meta.hasPrevPage || topPagesData.meta.hasNextPage) && (
              <Paginate
                hasPrevPage={topPagesData.meta.hasPrevPage}
                hasNextPage={topPagesData.meta.hasNextPage}
                onPrev={goPrevTopPages}
                onNext={() => goNextTopPages(topPagesData.meta.nextCursor)}
              />
            )}
        </Card>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>{t("Daily breakdown")}</Text>
            {isDailyLoading && <Badge variant="light">{t("Loading")}</Badge>}
          </Group>
          <Stack gap="xs">
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("Date")}</Table.Th>
                  <Table.Th>{t("Views")}</Table.Th>
                  <Table.Th>{t("Visitors")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(dailyData?.items ?? []).map((item) => (
                  <Table.Tr key={item.viewDate}>
                    <Table.Td>{item.viewDate}</Table.Td>
                    <Table.Td>{formatNumber(item.totalViews)}</Table.Td>
                    <Table.Td>{formatNumber(item.uniqueVisitors)}</Table.Td>
                  </Table.Tr>
                ))}
                {!isDailyLoading && (dailyData?.items.length ?? 0) === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text c="dimmed" size="sm">
                        {t("No analytics data for this range.")}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            {dailyData?.items &&
              dailyData.items.length > 0 &&
              (dailyData.meta.hasPrevPage || dailyData.meta.hasNextPage) && (
                <Paginate
                  hasPrevPage={dailyData.meta.hasPrevPage}
                  hasNextPage={dailyData.meta.hasNextPage}
                  onPrev={goPrevDaily}
                  onNext={() => goNextDaily(dailyData.meta.nextCursor)}
                />
              )}
          </Stack>
        </Card>
      </SimpleGrid>
    </>
  );
}
