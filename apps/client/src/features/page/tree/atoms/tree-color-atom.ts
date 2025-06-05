import { atom } from "jotai";

export const childRootMap = new Map<string, string>();

export const pageColorAtom = atom(new Map<string, string>());

export const updatePageColorAtom = atom(
  null,
  (get, set, { pageId, color }: { pageId: string; color: string }) => {
    const newColors = new Map(get(pageColorAtom));
    if (childRootMap.has(pageId)) {
      const rootPageId = childRootMap.get(pageId);
      newColors.set(rootPageId, color);
    }
    newColors.set(pageId, color);
    set(pageColorAtom, newColors);
  },
);

export const getPageColorAtom = atom((get) => {
  return (pageId: string): string => {
    const colors = get(pageColorAtom);
    if (childRootMap.has(pageId)) {
      const rootPageId = childRootMap.get(pageId);
      return colors.get(rootPageId);
    }
    return colors.get(pageId);
  };
});
