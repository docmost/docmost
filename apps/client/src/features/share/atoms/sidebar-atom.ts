import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { atom } from 'jotai/index';

export const tableOfContentAsideAtom = atomWithWebStorage<boolean>(
  "showTOC",
  true,
);

export const mobileTableOfContentAsideAtom = atom<boolean>(false);



const sidebarWidthAtom = atomWithWebStorage<number>('sidebarWidth', 300);