import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Skeleton,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconEdit,
  IconFileExport,
  IconLockOpen,
} from "@tabler/icons-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import { Feature } from "@/ee/features";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { LegalHoldCustodianList } from "@/ee/legal-hold/components/legal-hold-custodian-list";
import { LegalHoldExportTable } from "@/ee/legal-hold/components/legal-hold-export-table";
import { LegalHoldFormModal } from "@/ee/legal-hold/components/legal-hold-form-modal";
import { LegalHoldReleaseModal } from "@/ee/legal-hold/components/legal-hold-release-modal";
import { LegalHoldSpaceList } from "@/ee/legal-hold/components/legal-hold-space-list";
import { PreservedItemTable } from "@/ee/legal-hold/components/preserved-item-table";
import { LEGAL_HOLD_STATUS_BADGES } from "@/ee/legal-hold/legal-hold.utils";
import {
  useCreateLegalHoldExportMutation,
  useLegalHoldQuery,
} from "@/ee/legal-hold/queries/legal-hold-query";

const TABS = ["custodians", "spaces", "preserved", "exports"];
const DEFAULT_TAB = "custodians";

function DetailsSkeleton() {
  return (
    <Stack gap="xs" mt="sm" aria-busy>
      <Group gap="sm">
        <Skeleton height={24} width={240} />
        <Skeleton height={20} width={64} radius="xl" />
      </Group>
      <Skeleton height={14} width={360} />
      <Skeleton height={12} width={220} />
      <Skeleton height={12} width={140} />
      <Group gap="md" mt="lg">
        {[110, 90, 150, 70].map((width) => (
          <Skeleton key={width} height={20} width={width} />
        ))}
      </Group>
      <Stack gap="sm" mt="md">
        {[0, 1, 2].map((row) => (
          <Group key={row} gap="sm" wrap="nowrap">
            <Skeleton height={38} width={38} circle />
            <div>
              <Skeleton height={14} width={160} mb={6} />
              <Skeleton height={10} width={200} />
            </div>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}

export default function LegalHoldDetails() {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { legalHoldId } = useParams();
  const { isOwner } = useUserRole();
  const hasFeature = useHasFeature(Feature.LEGAL_HOLDS);
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpened, setFormOpened] = useState(false);
  const [releaseOpened, setReleaseOpened] = useState(false);
  const query = useLegalHoldQuery(isOwner ? legalHoldId : null);
  const exportMutation = useCreateLegalHoldExportMutation();
  const legalHold = query.data;

  if (!isOwner) {
    return null;
  }

  const tabParam = searchParams.get("tab");
  const activeTab = TABS.includes(tabParam) ? tabParam : DEFAULT_TAB;
  const isActive = legalHold?.status === "active";
  const status = legalHold && LEGAL_HOLD_STATUS_BADGES[legalHold.status];
  const formatDay = (date: string) =>
    formatLocalized(date, "MMM d, yyyy", "PP", locale);

  const setTab = (tab: string | null) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("tab", tab ?? DEFAULT_TAB);
        return next;
      },
      { replace: true },
    );

  const startExport = () =>
    exportMutation.mutate(
      { legalHoldId },
      { onSuccess: () => setTab("exports") },
    );

  return (
    <>
      <DocumentTitle title={legalHold?.name ?? t("Legal holds")} />

      <Anchor
        component={Link}
        to="/settings/legal-holds"
        size="sm"
        c="dimmed"
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <IconArrowLeft size={14} aria-hidden />
        {t("Legal holds")}
      </Anchor>

      {query.isError ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />} mt="md">
          {getApiErrorMessage(query.error, t("Failed to load legal hold"))}
        </Alert>
      ) : !legalHold ? (
        <DetailsSkeleton />
      ) : (
        <>
          <Group justify="space-between" align="flex-start" gap="md" mt="sm">
            <div style={{ minWidth: 0, flex: 1 }}>
              <Group gap="sm" wrap="nowrap">
                <Title order={1} size="h4" lineClamp={2}>
                  {legalHold.name}
                </Title>
                <Badge variant="light" color={status?.color ?? "gray"}>
                  {status ? t(status.label) : legalHold.status}
                </Badge>
              </Group>
              {legalHold.description && (
                <Text c="dimmed" mt={4} style={{ whiteSpace: "pre-wrap" }}>
                  {legalHold.description}
                </Text>
              )}
              <Text size="sm" c="dimmed" mt="xs">
                {legalHold.creator?.name
                  ? t("Created {{date}} by {{name}}", {
                      date: formatDay(legalHold.createdAt),
                      name: legalHold.creator.name,
                    })
                  : t("Created {{date}}", {
                      date: formatDay(legalHold.createdAt),
                    })}
              </Text>
              {legalHold.releasedAt && (
                <Text size="sm" c="dimmed">
                  {legalHold.releasedBy?.name
                    ? t("Released {{date}} by {{name}}", {
                        date: formatDay(legalHold.releasedAt),
                        name: legalHold.releasedBy.name,
                      })
                    : t("Released {{date}}", {
                        date: formatDay(legalHold.releasedAt),
                      })}
                </Text>
              )}
              <Text size="sm" c="dimmed">
                {t("{{count}} pages in scope", {
                  count: legalHold.pagesInScopeCount,
                })}
              </Text>
            </div>

            <Group gap="xs" wrap="nowrap">
              {hasFeature && isActive && (
                <Button
                  variant="default"
                  leftSection={<IconEdit size={16} />}
                  onClick={() => setFormOpened(true)}
                >
                  {t("Edit")}
                </Button>
              )}
              <Button
                variant="default"
                leftSection={<IconFileExport size={16} />}
                onClick={startExport}
                loading={exportMutation.isPending}
              >
                {t("Export")}
              </Button>
              {isActive && (
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconLockOpen size={16} />}
                  onClick={() => setReleaseOpened(true)}
                >
                  {t("Release")}
                </Button>
              )}
            </Group>
          </Group>

          <Tabs
            color="dark"
            value={activeTab}
            onChange={setTab}
            keepMounted={false}
            mt="lg"
          >
            <Tabs.List>
              <Tabs.Tab fw={500} value="custodians">
                {t("Custodians ({{count}})", {
                  count: legalHold.custodianCount,
                })}
              </Tabs.Tab>
              <Tabs.Tab fw={500} value="spaces">
                {t("Spaces ({{count}})", { count: legalHold.spaceCount })}
              </Tabs.Tab>
              <Tabs.Tab fw={500} value="preserved">
                {t("Preserved content ({{count}})", {
                  count: legalHold.preservedItemCount,
                })}
              </Tabs.Tab>
              <Tabs.Tab fw={500} value="exports">
                {t("Exports")}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="custodians" pt="md">
              <LegalHoldCustodianList custodians={legalHold.custodians} />
            </Tabs.Panel>
            <Tabs.Panel value="spaces" pt="md">
              <LegalHoldSpaceList spaces={legalHold.spaces} />
            </Tabs.Panel>
            <Tabs.Panel value="preserved" pt="md">
              <PreservedItemTable legalHoldId={legalHold.id} />
            </Tabs.Panel>
            <Tabs.Panel value="exports" pt="md">
              <LegalHoldExportTable
                legalHoldId={legalHold.id}
                onExport={startExport}
                isExporting={exportMutation.isPending}
              />
            </Tabs.Panel>
          </Tabs>
        </>
      )}

      <LegalHoldFormModal
        opened={formOpened}
        onClose={() => setFormOpened(false)}
        legalHoldId={legalHold?.id ?? null}
      />

      <LegalHoldReleaseModal
        opened={releaseOpened}
        onClose={() => setReleaseOpened(false)}
        legalHoldId={legalHold?.id ?? null}
      />
    </>
  );
}
