import { atom } from "jotai";

type SearchAndReplaceAtomType = {
  isOpen: boolean;
};

export const searchAndReplaceStateAtom = atom<SearchAndReplaceAtomType>({
  isOpen: false,
});
