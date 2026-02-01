import {
  ActionIcon,
  Box,
  Button,
  Combobox,
  Group,
  InputBase,
  Paper,
  ScrollArea,
  Switch,
  Text,
  useCombobox,
} from "@mantine/core";
import { useAtom } from "jotai";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
  diffCountsAtom,
  highlightChangesAtom,
  historyAtoms,
} from "@/features/page-history/atoms/history-atoms";
import HistoryView from "@/features/page-history/components/history-view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconChevronDown,
  IconChevronUp,
  IconSelector,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  usePageHistoryListQuery,
  usePageHistoryQuery,
} from "@/features/page-history/queries/page-history-query";
import { formattedDate } from "@/lib/time";
import {
  pageEditorAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability";
import { useSpaceQuery } from "@/features/space/queries/space-query";
import { useParams } from "react-router-dom";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type";
import classes from "./history-mobile.module.css";

interface Props {
  pageId: string;
  pageTitle?: string;
}

export default function HistoryModalMobile({ pageId, pageTitle }: Props) {
  const { t } = useTranslation();
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [activeHistoryId, setActiveHistoryId] = useAtom(activeHistoryIdAtom);
  const [, setActiveHistoryPrevId] = useAtom(activeHistoryPrevIdAtom);
  const [highlightChanges, setHighlightChanges] = useAtom(highlightChangesAtom);
  const [diffCounts, setDiffCounts] = useAtom(diffCountsAtom);
  const [, setHistoryModalOpen] = useAtom(historyAtoms);

  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const { data: pageHistoryData, isLoading } = usePageHistoryListQuery(pageId);
  const { data: activeHistoryData } = usePageHistoryQuery(activeHistoryId);

  const historyItems = useMemo(
    () => pageHistoryData?.pages.flatMap((page) => page.items) ?? [],
    [pageHistoryData],
  );

  const [mainEditor] = useAtom(pageEditorAtom);
  const [mainEditorTitle] = useAtom(titleEditorAtom);

  const { spaceSlug } = useParams();
  const { data: space } = useSpaceQuery(spaceSlug);
  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

  const canRestore = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Page,
  );

  useEffect(() => {
    setActiveHistoryId("");
    setActiveHistoryPrevId("");
    // @ts-ignore
    setDiffCounts(null);
  }, [pageId]);

  useEffect(() => {
    if (historyItems.length > 0 && !activeHistoryId) {
      setActiveHistoryId(historyItems[0].id);
      setActiveHistoryPrevId(historyItems[1]?.id ?? "");
    }
  }, [historyItems, activeHistoryId]);

  useEffect(() => {
    if (diffCounts && diffCounts.total > 0) {
      setCurrentChangeIndex(1);
      requestAnimationFrame(() => scrollToChangeIndex(1));
    } else {
      setCurrentChangeIndex(0);
    }
  }, [diffCounts]);

  const scrollToChangeIndex = (index: number) => {
    const viewport = scrollViewportRef.current;
    if (!viewport || index < 1) return;
    const element = viewport.querySelector(`[data-diff-index="${index}"]`);
    if (element instanceof HTMLElement) {
      const elementTop = element.offsetTop;
      const viewportHeight = viewport.clientHeight;
      const scrollTarget =
        elementTop - viewportHeight / 2 + element.offsetHeight / 2;
      viewport.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  };

  const handlePrevChange = () => {
    if (!diffCounts || diffCounts.total === 0) return;
    const newIndex =
      currentChangeIndex <= 1 ? diffCounts.total : currentChangeIndex - 1;
    setCurrentChangeIndex(newIndex);
    scrollToChangeIndex(newIndex);
  };

  const handleNextChange = () => {
    if (!diffCounts || diffCounts.total === 0) return;
    const newIndex =
      currentChangeIndex >= diffCounts.total ? 1 : currentChangeIndex + 1;
    setCurrentChangeIndex(newIndex);
    scrollToChangeIndex(newIndex);
  };

  const handleSelectVersion = useCallback(
    (id: string) => {
      const index = historyItems.findIndex((item) => item.id === id);
      if (index >= 0) {
        setActiveHistoryId(id);
        setActiveHistoryPrevId(historyItems[index + 1]?.id ?? "");
      }
      combobox.closeDropdown();
    },
    [historyItems, combobox],
  );

  const confirmRestore = () =>
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
  }, [activeHistoryData, mainEditor, mainEditorTitle, setHistoryModalOpen, t]);

  const selectedItem = historyItems.find((item) => item.id === activeHistoryId);

  const options = historyItems.map((item) => (
    <Combobox.Option
      value={item.id}
      key={item.id}
      className={classes.option}
      active={item.id === activeHistoryId}
    >
      <div>
        <Text size="sm">{formattedDate(new Date(item.createdAt))}</Text>
        <Text size="xs" c="dimmed">
          {item.lastUpdatedBy?.name}
        </Text>
      </div>
    </Combobox.Option>
  ));

  if (isLoading) {
    return null;
  }

  return (
    <Box className={classes.container}>
      <Box className={classes.selectorWrapper}>
        <Combobox
          store={combobox}
          onOptionSubmit={handleSelectVersion}
          withinPortal={false}
        >
          <Combobox.Target>
            <InputBase
              component="button"
              type="button"
              pointer
              rightSection={<IconSelector size={16} />}
              rightSectionPointerEvents="none"
              onClick={() => combobox.toggleDropdown()}
              className={classes.selector}
            >
              {selectedItem ? (
                <Text size="sm">
                  {formattedDate(new Date(selectedItem.createdAt))}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("Select version")}
                </Text>
              )}
            </InputBase>
          </Combobox.Target>

          <Combobox.Dropdown className={classes.dropdown}>
            <Combobox.Options>
              <ScrollArea.Autosize mah={300}>{options}</ScrollArea.Autosize>
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
      </Box>

      <ScrollArea
        className={classes.editorArea}
        viewportRef={scrollViewportRef}
        scrollbarSize={5}
      >
        <Box className={classes.editorContent}>
          {activeHistoryId && <HistoryView />}
        </Box>
      </ScrollArea>

      {canRestore && (
        <Group className={classes.actionButtons} justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => setHistoryModalOpen(false)}>
            {t("Close")}
          </Button>
          <Button onClick={confirmRestore}>{t("Restore")}</Button>
        </Group>
      )}

      {activeHistoryId && (
        <Paper
          shadow="sm"
          radius="xl"
          px="md"
          py="xs"
          className={classes.floatingBar}
        >
          <Group gap="sm" wrap="nowrap">
            <Switch
              label={t("Highlight changes")}
              checked={highlightChanges}
              onChange={(e) => setHighlightChanges(e.currentTarget.checked)}
              size="sm"
              styles={{ label: { userSelect: "none", whiteSpace: "nowrap" } }}
            />
            {highlightChanges && diffCounts && diffCounts.total > 0 && (
              <Group gap={4} wrap="nowrap">
                <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                  {currentChangeIndex} of {diffCounts.total}
                </Text>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={handlePrevChange}
                >
                  <IconChevronUp size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={handleNextChange}
                >
                  <IconChevronDown size={16} />
                </ActionIcon>
              </Group>
            )}
          </Group>
        </Paper>
      )}
    </Box>
  );
}
