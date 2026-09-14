import {
  ActionIcon,
  CloseButton,
  Group,
  Paper,
  ScrollArea,
  Switch,
  Text,
} from "@mantine/core";
import HistoryList from "@/features/page-history/components/history-list";
import classes from "./css/history.module.css";
import { useAtom, useAtomValue } from "jotai";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
  comparePairAtom,
  diffCountsAtom,
  highlightChangesAtom,
} from "@/features/page-history/atoms/history-atoms";
import HistoryView from "@/features/page-history/components/history-view";
import { useMemo, useRef } from "react";
import { IconChevronUp, IconChevronDown } from "@tabler/icons-react";
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
  const [highlightChanges, setHighlightChanges] = useAtom(highlightChangesAtom);
  const diffCounts = useAtomValue(diffCountsAtom);
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

      <div style={{ position: "relative", flex: 1 }}>
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
          <Paper
            shadow="md"
            radius="xl"
            px="md"
            py="xs"
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <Group gap="md" wrap="nowrap">
              <Switch
                label={t("Highlight changes")}
                checked={highlightChanges}
                onChange={(e) => setHighlightChanges(e.currentTarget.checked)}
                styles={{ label: { userSelect: "none", whiteSpace: "nowrap" } }}
              />
              {highlightChanges && diffCounts && diffCounts.total > 0 && (
                <Group gap="xs" wrap="nowrap">
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
      </div>
    </div>
  );
}
