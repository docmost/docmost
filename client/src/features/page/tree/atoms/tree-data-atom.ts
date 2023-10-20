import { atom } from "jotai";
import { TreeNode } from '@/features/page/tree/types';

export const treeDataAtom = atom<TreeNode[]>([]);
