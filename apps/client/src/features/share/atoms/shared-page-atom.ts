import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { ISharedPageTree } from "@/features/share/types/share.types";
import { SharedPageTreeNode } from "@/features/share/utils";

export const sharedPageTreeAtom = atom<ISharedPageTree | null>(null);
export const sharedTreeDataAtom = atom<SharedPageTreeNode[] | null>(null);
export const sharedPageFullWidthAtom = atomWithStorage<boolean>(
  "sharedPageFullWidth",
  false,
);