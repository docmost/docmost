import {
  usePageHistoryListQuery,
  usePageHistoryQuery,
} from "@/features/page-history/queries/page-history-query";
import HistoryItem from "@/features/page-history/components/history-item";
import {
  activeHistoryIdAtom,
  historyAtoms,
  previousHistoryIdAtom,
} from "@/features/page-history/atoms/history-atoms";
import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { Button, ScrollArea, Group, Divider, Text } from "@mantine/core";
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
  const [, setPreviousHistoryId] = useAtom(previousHistoryIdAtom);

  const {
    data: pageHistoryList,
    isLoading,
    isError,
  } = usePageHistoryListQuery(pageId);

  const handleSelectHistory = useCallback((id: string) => {
    setActiveHistoryId(id);

    if (pageHistoryList) {
      const currentIndex = pageHistoryList.items.findIndex(item => item.id === id);
      const previousItem = pageHistoryList.items[currentIndex + 1];
      setPreviousHistoryId(previousItem?.id || '');
    }
  }, [pageHistoryList, setActiveHistoryId, setPreviousHistoryId]);

  const { data: activeHistoryData } = usePageHistoryQuery(activeHistoryId);

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
        .setContent(activeHistoryData.title, true)
        .run();
      mainEditor
        .chain()
        .clearContent()
        .setContent(activeHistoryData.content)
        .run();
      setHistoryModalOpen(false);
      notifications.show({ message: t("Successfully restored") });
    }
  }, [activeHistoryData, mainEditor, mainEditorTitle, setHistoryModalOpen, t]);

  useEffect(() => {
    if (
      pageHistoryList &&
      pageHistoryList.items.length > 0 &&
      !activeHistoryId
    ) {
      handleSelectHistory(pageHistoryList.items[0].id);
    }
  }, [pageHistoryList, activeHistoryId, handleSelectHistory]);

  if (isLoading) {
    return <></>;
  }

  if (isError) {
    return <div>{t("Error loading page history.")}</div>;
  }

  if (!pageHistoryList || pageHistoryList.items.length === 0) {
    return <>{t("No page history saved yet.")}</>;
  }

  return (
    <div>
      <ScrollArea h={620} w="100%" type="scroll" scrollbarSize={5}>
        {pageHistoryList &&
          pageHistoryList.items.map((historyItem, index) => (
            <HistoryItem
              key={index}
              historyItem={historyItem}
              onSelect={handleSelectHistory}
              isActive={historyItem.id === activeHistoryId}
            />
          ))}
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
