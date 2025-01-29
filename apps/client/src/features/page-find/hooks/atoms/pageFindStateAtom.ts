import { atom } from "jotai";

type PageFindStateAtomType = {
  isOpen: boolean;
};

export const pageFindStateAtom = atom<PageFindStateAtomType>({
  isOpen: false,
});