import { useParams } from 'react-router-dom';
import { usePageQuery } from '@/features/page/queries/page-query';
import { FullEditor } from '@/features/editor/full-editor';
import HistoryModal from '@/features/page-history/components/history-modal';

export default function Page() {
  const { pageId } = useParams();
  const { data, isLoading, isError } = usePageQuery(pageId);

  if (isLoading) {
    return <></>;
  }

  if (isError || !data) { // TODO: fix this
    return <div>Error fetching page data.</div>;
  }

  return (
    data && (
      <div>
        <FullEditor key={pageId} pageId={pageId} title={data.title} />
        <HistoryModal />
      </div>
    )

  );
}
