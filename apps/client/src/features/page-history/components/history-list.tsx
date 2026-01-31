import {
  usePageHistoryListQuery,
  usePageHistoryQuery,
} from "@/features/page-history/queries/page-history-query";
import HistoryItem from "@/features/page-history/components/history-item";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
  historyAtoms,
} from "@/features/page-history/atoms/history-atoms";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Button,
  ScrollArea,
  Group,
  Divider,
  Text,
  Loader,
  Center,
} from "@mantine/core";
import {
  pageEditorAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useParams } from "react-router-dom";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";

interface Props {
  pageId: string;
}

function HistoryList({ pageId }: Props) {
  const { t } = useTranslation();
  const [activeHistoryId, setActiveHistoryId] = useAtom(activeHistoryIdAtom);
  const [, setActiveHistoryPrevId] = useAtom(activeHistoryPrevIdAtom);
  const {
    data: pageHistoryData,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePageHistoryListQuery(pageId);
  const { data: activeHistoryData } = usePageHistoryQuery(activeHistoryId);

  const historyItems = useMemo(
    () => pageHistoryData?.pages.flatMap((page) => page.items) ?? [],
    [pageHistoryData],
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [mainEditor] = useAtom(pageEditorAtom);
  const [mainEditorTitle] = useAtom(titleEditorAtom);
  const [, setHistoryModalOpen] = useAtom(historyAtoms);

  const { spaceSlug } = useParams();
  const { data: space } = useSpaceQuery(spaceSlug);
  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

  const confirmModal = () =>
    modals.openConfirmModal({
      title: t("Please confirm your action"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to restore this version? Any changes not versioned will be lost.",
          )}
        </Text>
      ),
      labels: { confirm: t("Confirm"), cancel: t("Cancel") },
      onConfirm: handleRestore,
    });

  const handleRestore = useCallback(() => {
    if (activeHistoryData) {
      mainEditorTitle
        .chain()
        .clearContent()
        .setContent(activeHistoryData.title, { emitUpdate: true })
        .run();
      mainEditor
        .chain()
        .clearContent()
        .setContent(activeHistoryData.content)
        .run();
      setHistoryModalOpen(false);
      notifications.show({ message: t("Successfully restored") });
    }
  }, [activeHistoryData]);

  useEffect(() => {
    if (historyItems.length > 0 && !activeHistoryId) {
      setActiveHistoryId(historyItems[0].id);
      setActiveHistoryPrevId(historyItems[1]?.id ?? "");
    }
  }, [historyItems, activeHistoryId, setActiveHistoryId, setActiveHistoryPrevId]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return <></>;
  }

  if (isError) {
    return <div>{t("Error loading page history.")}</div>;
  }

  if (historyItems.length === 0) {
    return <>{t("No page history saved yet.")}</>;
  }

  return (
    <div>
      <ScrollArea h={620} w="100%" type="scroll" scrollbarSize={5}>
        {historyItems.map((historyItem, index) => (
          <HistoryItem
            key={historyItem.id}
            historyItem={historyItem}
            onSelect={(id) => {
              setActiveHistoryId(id);
              setActiveHistoryPrevId(historyItems[index + 1]?.id ?? "");
            }}
            isActive={historyItem.id === activeHistoryId}
          />
        ))}
        {hasNextPage && <div ref={loadMoreRef} style={{ height: 1 }} />}
        {isFetchingNextPage && (
          <Center py="sm">
            <Loader size="sm" />
          </Center>
        )}
      </ScrollArea>

      {spaceAbility.cannot(
        SpaceCaslAction.Manage,
        SpaceCaslSubject.Page,
      ) ? null : (
        <>
          <Divider />
          <Group p="xs" wrap="nowrap">
            <Button size="compact-md" onClick={confirmModal}>
              {t("Restore")}
            </Button>
            <Button
              variant="default"
              size="compact-md"
              onClick={() => setHistoryModalOpen(false)}
            >
              {t("Cancel")}
            </Button>
          </Group>
        </>
      )}
    </div>
  );
}

export default HistoryList;
