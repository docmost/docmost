import { Suspense } from "react";
import { lazyWithPrefetch } from "@/lib/lazy-prefetch.ts";
import { NodeViewProps } from "@tiptap/react";

const ExcalidrawView = lazyWithPrefetch(
  () => import("@/features/editor/components/excalidraw/excalidraw-view.tsx"),
);

export default function ExcalidrawViewLazy(props: NodeViewProps) {
  return (
    <Suspense fallback={null}>
      <ExcalidrawView {...props} />
    </Suspense>
  );
}
