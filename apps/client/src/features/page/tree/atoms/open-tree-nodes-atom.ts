import { atom } from "jotai";

export type OpenMap = Record<string, boolean>;

export const openTreeNodesAtom = atom<OpenMap>({});
