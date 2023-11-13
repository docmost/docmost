import { useParams } from 'react-router-dom';
import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import Editor from '@/features/editor/editor';
import { pageAtom } from '@/features/page/atoms/page-atom';
import { usePageQuery } from '@/features/page/queries/page';

export default function Page() {
  const { pageId } = useParams();
  const [, setPage] = useAtom(pageAtom(pageId));
  const { data, isLoading, isError } = usePageQuery(pageId);

  useEffect(() => {
    if (data) {
      setPage(data);
    }
  }, [data, isLoading, setPage, pageId]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError || !data) { // TODO: fix this
    return <div>Error fetching page data.</div>;
  }

  return (<Editor key={pageId} pageId={pageId} />);
}
