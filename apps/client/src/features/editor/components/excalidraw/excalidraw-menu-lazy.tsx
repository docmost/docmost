import { lazy, Suspense } from "react";
import { EditorMenuProps } from "@/features/editor/components/table/types/types.ts";

const ExcalidrawMenu = lazy(
  () => import("@/features/editor/components/excalidraw/excalidraw-menu.tsx"),
);

export default function ExcalidrawMenuLazy(props: EditorMenuProps) {
  return (
    <Suspense fallback={null}>
      <ExcalidrawMenu {...props} />
    </Suspense>
  );
}
