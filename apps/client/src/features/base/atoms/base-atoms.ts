import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import { EditingCell } from "@/features/base/types/base.types";

// Atoms are scoped per-base via `pageId` so that two BaseTable instances
// rendered on the same page (e.g. multiple base embeds inside one
// document) don't share UI state. A global atom would otherwise cause
// each instance's `useEffect` writers to clobber the other's value
// every render — pinning React into a "Maximum update depth exceeded"
// loop.

export const activeViewIdAtomFamily = atomFamily((_pageId: string) =>
  atom<string | null>(null),
);

export const editingCellAtomFamily = atomFamily((_pageId: string) =>
  atom<EditingCell>(null),
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
