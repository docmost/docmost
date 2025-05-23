import { atom } from "jotai";
import { SpaceTreeNode } from "@/features/page/tree/types";
import { appendNodeChildren } from "../utils";

export const treeDataAtom = atom<SpaceTreeNode[]>([]);

// Atom
export const appendNodeChildrenAtom = atom(
  null,
  (
    get,
    set,
    { parentId, children }: { parentId: string; children: SpaceTreeNode[] }
  ) => {
    const currentTree = get(treeDataAtom);
    const updatedTree = appendNodeChildren(currentTree, parentId, children);
    set(treeDataAtom, updatedTree);
  }
);
