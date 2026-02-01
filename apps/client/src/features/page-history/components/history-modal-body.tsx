import { Badge, Group, Paper, ScrollArea, Switch } from "@mantine/core";
import { DiffCounts } from "@/features/page-history/components/history-editor";
import HistoryList from "@/features/page-history/components/history-list";
import classes from "./history.module.css";
import { useAtom } from "jotai";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
} from "@/features/page-history/atoms/history-atoms";
import HistoryView from "@/features/page-history/components/history-view";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    setActiveHistoryId("");
    setActiveHistoryPrevId("");
  }, [pageId]);

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
            </Group>
          </Paper>
        )}
      </div>
    </div>
  );
}
