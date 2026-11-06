import { atomWithStorage } from "jotai/utils";

export type OpenMap = Record<string, boolean>;

export const openTreeNodesAtom = atomWithStorage<OpenMap>(
  "docmost:open-tree-nodes:v1",
  {},
);
