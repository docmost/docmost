'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import("@/features/editor/Editor"), {
  ssr: false,
});

export default function Page() {
  const { pageId } = useParams();

  return (
    <div className="w-full h-[500px]">
      <Editor pageId={pageId} />
    </div>
  );
}
