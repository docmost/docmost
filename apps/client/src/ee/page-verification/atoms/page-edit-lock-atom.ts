import { atom } from "jotai";

export const unlockedVerifiedPageIdAtom = atom<string | null>(
  null as string | null,
);
