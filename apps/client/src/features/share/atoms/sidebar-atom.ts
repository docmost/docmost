import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { atom } from 'jotai';

export const tableOfContentAsideAtom = atomWithWebStorage<boolean>(
  "showTOC",
  true,
);

export const mobileTableOfContentAsideAtom = atom<boolean>(false);