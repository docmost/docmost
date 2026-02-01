import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  ScrollArea,
  Switch,
  Text,
} from "@mantine/core";
import HistoryList from "@/features/page-history/components/history-list";
import classes from "./history.module.css";
import { useAtom } from "jotai";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
  diffCountsAtom,
  highlightChangesAtom,
} from "@/features/page-history/atoms/history-atoms";
import HistoryView from "@/features/page-history/components/history-view";
import { useEffect, useRef, useState } from "react";
import { IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface Props {
  pageId: string;
}

export default function HistoryModalBody({ pageId }: Props) {
  const { t } = useTranslation();
  const [activeHistoryId, setActiveHistoryId] = useAtom(activeHistoryIdAtom);
  const [activeHistoryPrevId, setActiveHistoryPrevId] = useAtom(
    activeHistoryPrevIdAtom,
  );
  const [highlightChanges, setHighlightChanges] = useAtom(highlightChangesAtom);
  const [diffCounts, setDiffCounts] = useAtom(diffCountsAtom);

  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveHistoryId("");
    setActiveHistoryPrevId("");
    // @ts-ignore
    setDiffCounts(null);
  }, [pageId]);

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

  return (
    <div className={classes.sidebarFlex}>
      <nav className={classes.sidebar}>
        <div className={classes.sidebarMain}>
          <HistoryList pageId={pageId} />
        </div>
      </nav>

      <div style={{ position: "relative", flex: 1 }}>
        <ScrollArea
          h={650}
          w="100%"
          scrollbarSize={5}
          viewportRef={scrollViewportRef}
        >
          <div className={classes.sidebarRightSection}>
            {activeHistoryId && <HistoryView />}
          </div>
        </ScrollArea>

        {activeHistoryId && activeHistoryPrevId && (
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
            <Group gap="md">
              {diffCounts && (
                <Group gap="xs">
                  <Badge variant="filled" color="green" size="sm">
                    +{diffCounts.added}
                  </Badge>
                  <Badge variant="filled" color="red" size="sm">
                    -{diffCounts.deleted}
                  </Badge>
                </Group>
              )}
              <Switch
                label={t("Highlight changes")}
                checked={highlightChanges}
                onChange={(e) => setHighlightChanges(e.currentTarget.checked)}
                style={{ userSelect: "none" }}
              />
              {highlightChanges && diffCounts && diffCounts.total > 0 && (
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
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
