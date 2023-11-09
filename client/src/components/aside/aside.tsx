import React, { Suspense } from 'react';

const Comments = React.lazy(() => import('@/features/comment/comments'));

export default function Aside() {
  return (
    <Suspense fallback={<div>Loading comments...</div>}>
      <Comments />
    </Suspense>
  );
}
