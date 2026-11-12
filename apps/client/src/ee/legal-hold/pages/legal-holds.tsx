import { useState } from "react";
import { Alert, Button, Group, Space, Text } from "@mantine/core";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import Paginate from "@/components/common/paginate";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { SearchInput } from "@/components/common/search-input";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";
import useUserRole from "@/hooks/use-user-role.tsx";
import { getApiErrorMessage } from "@/lib/api-error";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { LegalHoldFormModal } from "@/ee/legal-hold/components/legal-hold-form-modal";
import { LegalHoldReleaseModal } from "@/ee/legal-hold/components/legal-hold-release-modal";
import { LegalHoldStatusFilter } from "@/ee/legal-hold/components/legal-hold-status-filter";
import { LegalHoldTable } from "@/ee/legal-hold/components/legal-hold-table";
import {
  isNotFound,
  useCreateLegalHoldExportMutation,
  useLegalHoldsQuery,
} from "@/ee/legal-hold/queries/legal-hold-query";
import type { LegalHoldListItem } from "@/ee/legal-hold/types/legal-hold.types";

export default function LegalHolds() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOwner } = useUserRole();
  const hasFeature = useHasFeature(Feature.LEGAL_HOLDS);
  // Entitlements stay null until they load, which must read as loading, not as unlicensed
  const entitlements = useAtomValue(entitlementAtom);
  const isUnlicensed = entitlements !== null && !hasFeature;
  const { search, cursor, goNext, goPrev, handleSearch, resetPagination } =
    usePaginateAndSearch();
  const [released, setReleased] = useState(false);
  const [formOpened, setFormOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  // Without the feature the list stays readable, so a lapsed license can still release and export
  const canLoad = isOwner && entitlements !== null;
  const query = useLegalHoldsQuery(
    {
      cursor,
      limit: 20,
      query: search,
      ...(released ? { released: true } : {}),
    },
    canLoad,
  );
  const exportMutation = useCreateLegalHoldExportMutation();

  if (!isOwner) {
    return null;
  }

  const openForm = (legalHoldId: string | null) => {
    setEditingId(legalHoldId);
    setFormOpened(true);
  };

  const startExport = (legalHold: LegalHoldListItem) =>
    exportMutation.mutate(
      { legalHoldId: legalHold.id },
      {
        onSuccess: () =>
          navigate(`/settings/legal-holds/${legalHold.id}?tab=exports`),
      },
    );

  return (
    <>
      <DocumentTitle title={t("Legal holds")} />

      <SettingsTitle title={t("Legal holds")} />

      {isUnlicensed && (
        <Alert icon={<IconInfoCircle size={16} />} color="yellow" mb="md">
          {t(
            "Your plan doesn't include legal holds. You can still release existing holds and export their content.",
          )}
        </Alert>
      )}

      <Group justify="space-between" align="center" wrap="nowrap" mb="md">
        <Text size="sm" c="dimmed">
          {t(
            "Preserve content from members and spaces, even after it's deleted, until you release the hold.",
          )}
        </Text>
        {hasFeature && (
          <Button onClick={() => openForm(null)} style={{ flexShrink: 0 }}>
            {t("New legal hold")}
          </Button>
        )}
      </Group>

      <Group gap="sm" align="flex-start">
        <SearchInput onSearch={handleSearch} />
        <LegalHoldStatusFilter
          released={released}
          onChange={(next) => {
            setReleased(next);
            resetPagination();
          }}
        />
      </Group>

      {query.isError && !query.data && !isNotFound(query.error) ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {getApiErrorMessage(query.error, t("Failed to load legal holds"))}
        </Alert>
      ) : (
        <>
          <LegalHoldTable
            legalHolds={query.data?.items ?? []}
            isLoading={query.isLoading || entitlements === null}
            emptyMessage={
              search
                ? t("No results found...")
                : released
                  ? t("No released legal holds")
                  : t("No active legal holds")
            }
            onEdit={
              hasFeature ? (legalHold) => openForm(legalHold.id) : undefined
            }
            onExport={startExport}
            onRelease={(legalHold) => setReleasingId(legalHold.id)}
          />

          <Space h="md" />

          {query.data?.items.length > 0 && (
            <Paginate
              hasPrevPage={query.data.meta.hasPrevPage}
              hasNextPage={query.data.meta.hasNextPage}
              onNext={() => goNext(query.data.meta.nextCursor)}
              onPrev={goPrev}
            />
          )}
        </>
      )}

      <LegalHoldFormModal
        opened={formOpened}
        onClose={() => setFormOpened(false)}
        onExitTransitionEnd={() => setEditingId(null)}
        onCreated={(legalHold) =>
          navigate(`/settings/legal-holds/${legalHold.id}`)
        }
        legalHoldId={editingId}
      />

      <LegalHoldReleaseModal
        opened={releasingId !== null}
        onClose={() => setReleasingId(null)}
        legalHoldId={releasingId}
      />
    </>
  );
}
