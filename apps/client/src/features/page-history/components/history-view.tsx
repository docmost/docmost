import { usePageHistoryQuery } from '@/features/page-history/queries/page-history-query';
import { HistoryEditor } from '@/features/page-history/components/history-editor';

interface HistoryProps {
  historyId: string;
}

function HistoryView({ historyId }: HistoryProps) {
  const { data, isLoading, isError } = usePageHistoryQuery(historyId);

  if (isLoading) {
    return <></>;
  }

  if (isError || !data) {
    return <div>Error fetching page data.</div>;
  }

  return (data &&
    <div>
      <HistoryEditor content={data.content} title={data.title} />
    </div>
  );
}

export default HistoryView;
