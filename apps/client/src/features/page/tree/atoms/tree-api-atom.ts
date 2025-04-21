import { atom } from "jotai";
import { TreeApi } from "react-arborist";
import { SpaceTreeNode } from "../types";

export const treeApiAtom = atom<TreeApi<SpaceTreeNode> | null>(null);
