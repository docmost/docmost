import { atom } from "jotai";
import { EditingCell } from "@/features/base/types/base.types";

export const activeViewIdAtom = atom<string | null>(null);

export const editingCellAtom = atom<EditingCell>(null);

export const activePropertyMenuAtom = atom<string | null>(null);

export const propertyMenuDirtyAtom = atom<boolean>(false);

export const propertyMenuCloseRequestAtom = atom<number>(0);
