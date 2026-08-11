import {
  usePageHistoryListQuery,
  prefetchPageHistory,
} from "@/features/page-history/queries/page-history-query";
import HistoryItem from "@/features/page-history/components/history-item";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
  compareModeAtom,
  comparePairAtom,
  compareSelectionAtom,
  historyAtoms,
} from "@/features/page-history/atoms/history-atoms";
import { resolveComparePair } from "@/features/page-history/utils/resolve-compare-pair";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Button,
  ScrollArea,
  Group,
  Divider,
  Loader,
  Center,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useHistoryRestore } from "@/features/page-history/hooks";

const PREFETCH_DELAY_MS = 150;

interface Props {
  pageId: string;
}

function HistoryList({ pageId }: Props) {
  const { t } = useTranslation();
  const [activeHistoryId, setActiveHistoryId] = useAtom(activeHistoryIdAtom);
  const setActiveHistoryPrevId = useSetAtom(activeHistoryPrevIdAtom);
  const setHistoryModalOpen = useSetAtom(historyAtoms);
  const [compareMode, setCompareMode] = useAtom(compareModeAtom);
  const [compareSelection, setCompareSelection] = useAtom(compareSelectionAtom);
  const setComparePair = useSetAtom(comparePairAtom);

  const {
    data: pageHistoryData,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePageHistoryListQuery(pageId);

  const historyItems = useMemo(
    () => pageHistoryData?.pages.flatMap((page) => page.items) ?? [],
    [pageHistoryData],
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const prefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { canRestore, confirmRestore } = useHistoryRestore();

  const clearPrefetchTimeout = useCallback(() => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = null;
    }
  }, []);

  const handleHover = useCallback(
    (historyId: string, index: number) => {
      clearPrefetchTimeout();
      prefetchTimeoutRef.current = setTimeout(() => {
        prefetchPageHistory(historyId);
        const prevId = historyItems[index + 1]?.id;
        if (prevId) {
          prefetchPageHistory(prevId);
        }
      }, PREFETCH_DELAY_MS);
    },
    [clearPrefetchTimeout, historyItems],
  );

  useEffect(() => {
    return clearPrefetchTimeout;
  }, [clearPrefetchTimeout]);

  const handleSelect = useCallback(
    (id: string, index: number) => {
      setComparePair(null);
      setActiveHistoryId(id);
      setActiveHistoryPrevId(historyItems[index + 1]?.id ?? "");
    },
    [historyItems, setActiveHistoryId, setActiveHistoryPrevId, setComparePair],
  );

  const handleToggleCompare = useCallback(
    (id: string) => {
      setCompareSelection((prev) => {
        if (prev.includes(id)) return prev.filter((item) => item !== id);
        if (prev.length >= 2) return prev;
        return [...prev, id];
      });
    },
    [setCompareSelection],
  );

  const handleStartCompare = useCallback(
    (id: string) => {
      setComparePair(null);
      setCompareMode(true);
      setCompareSelection([id]);
    },
    [setComparePair, setCompareMode, setCompareSelection],
  );

  const handleCancelCompare = useCallback(() => {
    setCompareMode(false);
    setCompareSelection([]);
  }, [setCompareMode, setCompareSelection]);

  const handleConfirmCompare = useCallback(() => {
    const pair = resolveComparePair(historyItems, compareSelection);
    if (!pair) return;
    setComparePair(pair);
    setCompareMode(false);
    setCompareSelection([]);
  }, [
    historyItems,
    compareSelection,
    setComparePair,
    setCompareMode,
    setCompareSelection,
  ]);

  const handleRestoreItem = useCallback(
    (id: string, index: number) => {
      handleSelect(id, index);
      confirmRestore(id);
    },
    [handleSelect, confirmRestore],
  );

  useEffect(() => {
    if (historyItems.length > 0 && !activeHistoryId) {
      setActiveHistoryId(historyItems[0].id);
      setActiveHistoryPrevId(historyItems[1]?.id ?? "");
    }
  }, [
    historyItems,
    activeHistoryId,
    setActiveHistoryId,
    setActiveHistoryPrevId,
  ]);

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
            index={index}
            onSelect={handleSelect}
            onHover={handleHover}
            onHoverEnd={clearPrefetchTimeout}
            isActive={historyItem.id === activeHistoryId}
            compareMode={compareMode}
            isChecked={compareSelection.includes(historyItem.id)}
            isCheckboxDisabled={
              !compareSelection.includes(historyItem.id) &&
              compareSelection.length >= 2
            }
            canCompare={historyItems.length >= 2}
            onToggleCompare={handleToggleCompare}
            onStartCompare={handleStartCompare}
            onRestore={canRestore ? handleRestoreItem : undefined}
          />
        ))}
        {hasNextPage && <div ref={loadMoreRef} style={{ height: 1 }} />}
        {isFetchingNextPage && (
          <Center py="sm">
            <Loader size="sm" />
          </Center>
        )}
      </ScrollArea>

      {compareMode ? (
        <>
          <Divider />
          <Group p="xs" wrap="nowrap">
            <Button
              variant="default"
              size="compact-md"
              onClick={handleCancelCompare}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="compact-md"
              disabled={compareSelection.length !== 2}
              onClick={handleConfirmCompare}
            >
              {t("Compare")}
            </Button>
          </Group>
        </>
      ) : (
        canRestore && (
          <>
            <Divider />
            <Group p="xs" wrap="nowrap">
              <Button
                variant="default"
                size="compact-md"
                onClick={() => setHistoryModalOpen(false)}
              >
                {t("Cancel")}
              </Button>
              <Button size="compact-md" onClick={() => confirmRestore()}>
                {t("Restore")}
              </Button>
            </Group>
          </>
        )
      )}
    </div>
  );
}

export default HistoryList;
