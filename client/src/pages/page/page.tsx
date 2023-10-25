import { useParams } from 'react-router-dom';
import React, { Suspense } from 'react';

const Editor = React.lazy(() => import('@/features/editor/editor'));

export default function Page() {
  const { pageId } = useParams();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Editor key={pageId} pageId={pageId} />
    </Suspense>
  );
}
