import { atom } from "jotai";
import { SpaceTreeNode } from "@/features/page/tree/types";

export const treeDataAtom = atom<SpaceTreeNode[]>([]);

export const sortByAtom = atom<'position' | 'alphabetical' | 'recent'>('position');
