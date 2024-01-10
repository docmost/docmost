import { ScrollArea } from '@mantine/core';
import HistoryList from '@/features/page-history/components/history-list';
import classes from './history.module.css';
import { useAtom } from 'jotai';
import { activeHistoryIdAtom } from '@/features/page-history/atoms/history-atoms';
import HistoryView from '@/features/page-history/components/history-view';

export default function HistoryModalBody() {
  const [activeHistoryId] = useAtom(activeHistoryIdAtom);

  return (
    <div className={classes.sidebarFlex}>
      <nav className={classes.sidebar}>
        <div className={classes.sidebarMain}>
          <HistoryList />
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
