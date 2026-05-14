import { lazy, Suspense } from "react";
import { NodeViewProps } from "@tiptap/react";

const ExcalidrawView = lazy(
  () => import("@/features/editor/components/excalidraw/excalidraw-view.tsx"),
);

export default function ExcalidrawViewLazy(props: NodeViewProps) {
  return (
    <Suspense fallback={null}>
      <ExcalidrawView {...props} />
    </Suspense>
  );
}
