import { Suspense } from "react";
import { lazyWithPrefetch } from "@/lib/lazy-prefetch.ts";
import { EditorMenuProps } from "@/features/editor/components/table/types/types.ts";

const ExcalidrawMenu = lazyWithPrefetch(
  () => import("@/features/editor/components/excalidraw/excalidraw-menu.tsx"),
);

export default function ExcalidrawMenuLazy(props: EditorMenuProps) {
  return (
    <Suspense fallback={null}>
      <ExcalidrawMenu {...props} />
    </Suspense>
  );
}
