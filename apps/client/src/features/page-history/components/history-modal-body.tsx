import { ScrollArea } from "@mantine/core";
import HistoryList from "@/features/page-history/components/history-list";
import classes from "./history.module.css";
import { useAtom } from "jotai";
import { activeHistoryIdAtom } from "@/features/page-history/atoms/history-atoms";
import HistoryView from "@/features/page-history/components/history-view";
import { useEffect } from "react";

interface Props {
  pageId: string;
}

export default function HistoryModalBody({ pageId }: Props) {
  const [activeHistoryId, setActiveHistoryId] = useAtom(activeHistoryIdAtom);

  useEffect(() => {
    setActiveHistoryId("");
  }, [pageId]);

  return (
    <div className={classes.sidebarFlex}>
      <nav className={classes.sidebar}>
        <div className={classes.sidebarMain}>
          <HistoryList pageId={pageId} />
        </div>
      </nav>

      <ScrollArea h="650" w="100%" scrollbarSize={5}>
        <div className={classes.sidebarRightSection}>
          {activeHistoryId && <HistoryView historyId={activeHistoryId} />}
        </div>
      </ScrollArea>
    </div>
  );
}
