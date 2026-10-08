import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import { EditingCell, FocusedCell } from "@/ee/base/types/base.types";

// Atoms are scoped per-base via `pageId` so that two BaseTable instances on
// the same page don't share UI state.

export const activeViewIdAtomFamily = atomFamily((_pageId: string) =>
  atom<string | null>(null),
);

export const editingCellAtomFamily = atomFamily((_pageId: string) =>
  atom<EditingCell>(null),
);

export type FormulaEditorTarget = {
  propertyId: string;
  rowId: string | null;
} | null;

export const activeFormulaEditorAtomFamily = atomFamily((_pageId: string) =>
  atom<FormulaEditorTarget>(null),
);

export const activePropertyMenuAtomFamily = atomFamily((_pageId: string) =>
  atom<string | null>(null),
);

export const propertyMenuDirtyAtomFamily = atomFamily((_pageId: string) =>
  atom<boolean>(false),
);

export const propertyMenuCloseRequestAtomFamily = atomFamily((_pageId: string) =>
  atom<number>(0),
);

export const selectedRowIdsAtomFamily = atomFamily((_pageId: string) =>
  atom<Set<string>>(new Set<string>()),
);

export const lastToggledRowIndexAtomFamily = atomFamily((_pageId: string) =>
  atom<number | null>(null),
);

export const focusedCellAtomFamily = atomFamily((_pageId: string) =>
  atom<FocusedCell>(null),
);

export type PendingTypeInsert = {
  rowId: string;
  propertyId: string;
  char: string;
} | null;

export const pendingTypeInsertAtom = atom<PendingTypeInsert>(null);
