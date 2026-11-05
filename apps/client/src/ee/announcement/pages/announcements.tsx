import { useState } from "react";
import { Alert, Button, Group, Space, Tabs, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import Paginate from "@/components/common/paginate";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import useUserRole from "@/hooks/use-user-role.tsx";
import type { IPagination } from "@/lib/types";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { AnnouncementFormModal } from "@/ee/announcement/components/announcement-form-modal";
import { AnnouncementTable } from "@/ee/announcement/components/announcement-table";
import {
  getAnnouncementErrorMessage,
  useAnnouncementsQuery,
  useArchiveAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useUnarchiveAnnouncementMutation,
} from "@/ee/announcement/queries/announcement-query";
import type { IAnnouncement } from "@/ee/announcement/types/announcement.types";

type AnnouncementsTab = "current" | "archived";

export default function Announcements() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const hasFeature = useHasFeature(Feature.ANNOUNCEMENTS);
  // Entitlements stay null until they load, which must read as loading, not as unlicensed
  const entitlements = useAtomValue(entitlementAtom);
  const isUnlicensed = entitlements !== null && !hasFeature;
  const [tab, setTab] = useState<AnnouncementsTab>("current");
  const currentPage = useCursorPaginate();
  const archivedPage = useCursorPaginate();
  const [formOpened, setFormOpened] = useState(false);
  const [selected, setSelected] = useState<IAnnouncement | null>(null);
  const canLoad = isAdmin && hasFeature;
  const currentQuery = useAnnouncementsQuery(
    { cursor: currentPage.cursor, limit: 20 },
    canLoad,
  );
  const archivedQuery = useAnnouncementsQuery(
    { archived: true, cursor: archivedPage.cursor, limit: 20 },
    canLoad && tab === "archived",
  );
  const archiveMutation = useArchiveAnnouncementMutation();
  const unarchiveMutation = useUnarchiveAnnouncementMutation();
  const deleteMutation = useDeleteAnnouncementMutation();

  if (!isAdmin) {
    return null;
  }

  const openForm = (announcement: IAnnouncement | null) => {
    setSelected(announcement);
    setFormOpened(true);
  };

  const confirmDelete = (announcement: IAnnouncement) =>
    modals.openConfirmModal({
      title: t("Delete announcement"),
      centered: true,
      children: (
        <Text size="sm">
          {t("This announcement will be permanently deleted.")}
        </Text>
      ),
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () =>
        deleteMutation.mutate({ announcementId: announcement.id }),
    });

  const tableActions = {
    onEdit: openForm,
    onArchive: (announcement: IAnnouncement) =>
      archiveMutation.mutate({ announcementId: announcement.id }),
    onUnarchive: (announcement: IAnnouncement) =>
      unarchiveMutation.mutate({ announcementId: announcement.id }),
    onDelete: confirmDelete,
  };

  const loadError = (error: Error) => (
    <Alert icon={<IconAlertCircle size={16} />} color="red">
      {t("Could not load announcements: {{message}}", {
        message: getAnnouncementErrorMessage(error),
      })}
    </Alert>
  );

  const renderList = (
    query: UseQueryResult<IPagination<IAnnouncement>, Error>,
    page: ReturnType<typeof useCursorPaginate>,
    emptyMessage: string,
  ) =>
    query.isError && !query.data ? (
      loadError(query.error)
    ) : (
      <>
        <AnnouncementTable
          announcements={query.data?.items ?? []}
          isLoading={query.isLoading || entitlements === null}
          emptyMessage={emptyMessage}
          {...tableActions}
        />

        <Space h="md" />

        {query.data?.items.length > 0 && (
          <Paginate
            hasPrevPage={query.data.meta.hasPrevPage}
            hasNextPage={query.data.meta.hasNextPage}
            onNext={() => page.goNext(query.data.meta.nextCursor)}
            onPrev={page.goPrev}
          />
        )}
      </>
    );

  return (
    <>
      <DocumentTitle title={t("Announcements")} />

      <SettingsTitle title={t("Announcements")} />

      {isUnlicensed && (
        <Alert icon={<IconInfoCircle size={16} />} color="yellow" mb="md">
          {t("Announcements require an Enterprise license.")}
        </Alert>
      )}

      <Group justify="space-between" align="center" wrap="nowrap" mb="md">
        <Text size="sm" c="dimmed">
          {t(
            "Show a banner at the top of every page. Up to two can show at the same time.",
          )}
        </Text>
        <Button
          onClick={() => openForm(null)}
          disabled={isUnlicensed}
          style={{ flexShrink: 0 }}
        >
          {t("New announcement")}
        </Button>
      </Group>

      <Tabs
        color="dark"
        value={tab}
        onChange={(value) => setTab(value as AnnouncementsTab)}
      >
        <Tabs.List>
          <Tabs.Tab fw={500} value="current">
            {t("Current")}
          </Tabs.Tab>
          <Tabs.Tab fw={500} value="archived">
            {t("Archived")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="current" pt="md">
          {renderList(currentQuery, currentPage, t("No current announcements"))}
        </Tabs.Panel>

        <Tabs.Panel value="archived" pt="md">
          {renderList(
            archivedQuery,
            archivedPage,
            t("No archived announcements"),
          )}
        </Tabs.Panel>
      </Tabs>

      <AnnouncementFormModal
        opened={formOpened}
        onClose={() => setFormOpened(false)}
        announcement={selected}
      />
    </>
  );
}
