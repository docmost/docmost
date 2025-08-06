import { atom } from "jotai";
import { SpaceTreeNode } from "@/features/page/tree/types";
import { appendNodeChildren } from "../utils";
import type { TreeInstance } from "@headless-tree/core";

export const treeDataAtom = atom<{ tree: TreeInstance<SpaceTreeNode> | null }>({ tree: null });
