import { atom } from "jotai";
import { Editor } from "@tiptap/core";
import { PageEditMode } from "@/features/user/types/user.types.ts";

export const pageEditorAtom = atom<Editor | null>(null);

export const titleEditorAtom = atom<Editor | null>(null);

export const readOnlyEditorAtom = atom<Editor | null>(null);

export const yjsConnectionStatusAtom = atom<string>("");

export const yjsSyncedAtom = atom<boolean>(false);

// True while the local Y.Doc holds edits the server has not acknowledged.
// Distinct from yjsSyncedAtom, which means "initial reconciliation happened"
// and is consumed as such by empty-page-get-started.
export const yjsUnsyncedAtom = atom<boolean>(false);

export const showAiMenuAtom = atom(false);

export const showLinkMenuAtom = atom(false);

// Current page's edit mode — initialized from the user's saved preference on
// first load, can be toggled locally without persisting to the server.
export const currentPageEditModeAtom = atom<PageEditMode>(PageEditMode.Edit);
