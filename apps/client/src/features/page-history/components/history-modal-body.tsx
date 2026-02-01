import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  ScrollArea,
  Switch,
  Text,
} from "@mantine/core";
import {
  DiffCounts,
  HistoryEditorHandle,
} from "@/features/page-history/components/history-editor";
import HistoryList from "@/features/page-history/components/history-list";
import classes from "./history.module.css";
import { useAtom } from "jotai";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
} from "@/features/page-history/atoms/history-atoms";
import HistoryView from "@/features/page-history/components/history-view";
import { useEffect, useRef, useState } from "react";
import { IconChevronUp, IconChevronDown } from "@tabler/icons-react";

interface Props {
  pageId: string;
}

export default function HistoryModalBody({ pageId }: Props) {
  const [activeHistoryId, setActiveHistoryId] = useAtom(activeHistoryIdAtom);
  const [activeHistoryPrevId, setActiveHistoryPrevId] = useAtom(
    activeHistoryPrevIdAtom,
  );
  const [highlightChanges, setHighlightChanges] = useState(true);
  const [diffCounts, setDiffCounts] = useState<DiffCounts | null>(null);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const historyEditorRef = useRef<HistoryEditorHandle>(null);

  useEffect(() => {
    setActiveHistoryId("");
    setActiveHistoryPrevId("");
  }, [pageId]);

  useEffect(() => {
    setCurrentChangeIndex(0);
  }, [activeHistoryId]);

  const handlePrevChange = () => {
    if (!diffCounts || diffCounts.total === 0) return;
    const newIndex =
      currentChangeIndex <= 1 ? diffCounts.total : currentChangeIndex - 1;
    setCurrentChangeIndex(newIndex);
    historyEditorRef.current?.scrollToChange(newIndex);
  };

  const handleNextChange = () => {
    if (!diffCounts || diffCounts.total === 0) return;
    const newIndex =
      currentChangeIndex >= diffCounts.total ? 1 : currentChangeIndex + 1;
    setCurrentChangeIndex(newIndex);
    historyEditorRef.current?.scrollToChange(newIndex);
  };

  return (
    <div className={classes.sidebarFlex}>
      <nav className={classes.sidebar}>
        <div className={classes.sidebarMain}>
          <HistoryList pageId={pageId} />
        </div>
      </nav>

      <div style={{ position: "relative", flex: 1 }}>
        <ScrollArea h={650} w="100%" scrollbarSize={5}>
          <div className={classes.sidebarRightSection}>
            {activeHistoryId && (
              <HistoryView
                ref={historyEditorRef}
                historyId={activeHistoryId}
                prevHistoryId={activeHistoryPrevId}
                highlightChanges={highlightChanges}
                onDiffCalculated={setDiffCounts}
              />
            )}
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
                label="Highlight changes"
                checked={highlightChanges}
                onChange={(e) => setHighlightChanges(e.currentTarget.checked)}
              />
              {diffCounts && diffCounts.total > 0 && (
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
