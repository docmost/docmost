import { useParams } from 'react-router-dom';
import React, { useEffect } from 'react';
import { useAtom } from 'jotai/index';
import usePage from '@/features/page/hooks/use-page';
import Editor from '@/features/editor/editor';
import { pageAtom } from '@/features/page/atoms/page-atom';

export default function Page() {
  const { pageId } = useParams();
  const [, setPage] = useAtom(pageAtom(pageId));
  const { pageQuery } = usePage(pageId);

  useEffect(() => {
    if (pageQuery.data) {
      setPage(pageQuery.data);
    }
  }, [pageQuery.data, pageQuery.isLoading, setPage, pageId]);

  if (pageQuery.isLoading) {
    return <div>Loading...</div>;
  }

  if (pageQuery.isError) {
    return <div>Error fetching page data.</div>;
  }

  return (<Editor key={pageId} pageId={pageId} />);
}
