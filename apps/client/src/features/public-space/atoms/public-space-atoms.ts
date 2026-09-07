import { atom } from "jotai";
import { IPublicSpaceTree } from "@/features/public-space/types/public-space.types.ts";
import { SharedPageTreeNode } from "@/features/share/utils.ts";

export const publicSpaceTreeAtom = atom<IPublicSpaceTree | null>(
  null as IPublicSpaceTree | null,
);

export const publicSpaceTreeDataAtom = atom<SharedPageTreeNode[] | null>(
  null as SharedPageTreeNode[] | null,
);

export const openPublicSpaceTreeNodesAtom = atom<Record<string, boolean>>({});

export const docsMobileSidebarAtom = atom<boolean>(false);

export const docsMobileTocAtom = atom<boolean>(false);
