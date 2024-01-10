import { atom } from "jotai";
import { TreeApi } from 'react-arborist';
import { TreeNode } from "../types";

export const treeApiAtom = atom<TreeApi<TreeNode> | null>(null);
