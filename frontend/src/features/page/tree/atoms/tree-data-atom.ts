import { atom } from "jotai";
import { TreeNode } from "../types";

export const treeDataAtom = atom<TreeNode[]>([]);
