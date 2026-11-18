import { CloseButton, Group, ScrollArea, Text } from "@mantine/core";
import HistoryList from "@/features/page-history/components/history-list";
import classes from "./css/history.module.css";
import { useAtom, useAtomValue } from "jotai";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
  comparePairAtom,
} from "@/features/page-history/atoms/history-atoms";
import HistoryView from "@/features/page-history/components/history-view";
import { useMemo, useRef } from "react";
import HistoryDiffBar from "@/features/page-history/components/history-diff-bar";
import { useTranslation } from "react-i18next";
import {
  useDiffNavigation,
  useHistoryReset,
} from "@/features/page-history/hooks";
import { usePageHistoryListQuery } from "@/features/page-history/queries/page-history-query";
import { formattedDate } from "@/lib/time";

interface Props {
  pageId: string;
}

export default function HistoryModalBody({ pageId }: Props) {
  const { t } = useTranslation();
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const activeHistoryId = useAtomValue(activeHistoryIdAtom);
  const activeHistoryPrevId = useAtomValue(activeHistoryPrevIdAtom);
  const [comparePair, setComparePair] = useAtom(comparePairAtom);

  const { data: pageHistoryData } = usePageHistoryListQuery(pageId);
  const historyItems = useMemo(
    () => pageHistoryData?.pages.flatMap((page) => page.items) ?? [],
    [pageHistoryData],
  );

  const compareLabel = useMemo(() => {
    if (!comparePair) return null;
    const newerItem = historyItems.find(
      (item) => item.id === comparePair.newerId,
    );
    const olderItem = historyItems.find(
      (item) => item.id === comparePair.olderId,
    );
    if (!newerItem || !olderItem) return null;
    return t("Comparing {{newer}} and {{older}}", {
      newer: formattedDate(new Date(newerItem.createdAt)),
      older: formattedDate(new Date(olderItem.createdAt)),
    });
  }, [comparePair, historyItems, t]);

  useHistoryReset(pageId);
  const { currentChangeIndex, handlePrevChange, handleNextChange } =
    useDiffNavigation(scrollViewportRef);

  return (
    <div className={classes.sidebarFlex}>
      <nav className={classes.sidebar}>
        <div className={classes.sidebarMain}>
          <HistoryList pageId={pageId} />
        </div>
      </nav>

      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        {comparePair && (
          <Group
            justify="space-between"
            wrap="nowrap"
            px="md"
            py={4}
            className={classes.compareBanner}
          >
            <Text size="sm" fw={500} lineClamp={1}>
              {compareLabel ?? t("Compare versions")}
            </Text>
            <CloseButton
              size="sm"
              aria-label={t("Exit compare")}
              onClick={() => setComparePair(null)}
            />
          </Group>
        )}

        <ScrollArea
          h={650}
          w="100%"
          scrollbarSize={5}
          viewportRef={scrollViewportRef}
        >
          <div className={classes.sidebarRightSection}>
            {comparePair ? (
              <HistoryView
                historyId={comparePair.newerId}
                prevHistoryId={comparePair.olderId}
              />
            ) : (
              activeHistoryId && <HistoryView />
            )}
          </div>
        </ScrollArea>

        {(comparePair || (activeHistoryId && activeHistoryPrevId)) && (
          <HistoryDiffBar
            currentChangeIndex={currentChangeIndex}
            onPrev={handlePrevChange}
            onNext={handleNextChange}
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          />
        )}
      </div>
    </div>
  );
}
