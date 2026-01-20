import { atom } from "jotai";

export const historyAtoms = atom<boolean>(false);
export const activeHistoryIdAtom = atom<string>("");
export const activeHistoryPrevIdAtom = atom<string>("");
