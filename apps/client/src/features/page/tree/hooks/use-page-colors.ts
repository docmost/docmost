import { useAtom } from "jotai";
import { IPage } from "@/features/page/types/page.types";
import {
  childRootMap,
  getPageColorAtom,
  updatePageColorAtom,
} from "@/features/page/tree/atoms/tree-color-atom";

export function usePageColors() {
  const [, setPageColor] = useAtom(updatePageColorAtom);
  const [getPageColor] = useAtom(getPageColorAtom);

  const colors = ["#4CAF50", "#2196F3", "#9C27B0", "#FF9800", "#E91E63"];

  const loadColors = (pages: Partial<IPage>[]) => {
    pages.forEach((page) => {
      if (page?.parentPageId !== null) {
        if (childRootMap.has(page.parentPageId)) {
          const rootPageId = childRootMap.get(page.parentPageId);
          childRootMap.set(page.id, rootPageId);
        } else {
          childRootMap.set(page.id, page.parentPageId);
        }

        const rootPageId = childRootMap.get(page.id);
        const rootPageColor = getPageColor(rootPageId);
        setPageColor({ pageId: page.id, color: rootPageColor });

        for (const [childId, rootId] of childRootMap) {
          if (page.id === rootId) {
            childRootMap.set(childId, rootPageId);
          }
        }

        return;
      }

      if (childRootMap.has(page.id)) {
        childRootMap.delete(page.id);
      }

      const existingColor = getPageColor(page.id);
      if (existingColor === page.color) {
        return;
      }

      const color =
        page.color ?? colors[Math.floor(Math.random() * colors.length)];
      setPageColor({ pageId: page.id, color });
    });
  };

  return { loadColors };
}
