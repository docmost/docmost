import { atom } from "jotai";
import { Editor } from "@tiptap/core";

export const pageEditorAtom = atom<Editor | null>(null);

export const titleEditorAtom = atom<Editor | null>(null);

export const readOnlyEditorAtom = atom<Editor | null>(null);

export const yjsConnectionStatusAtom = atom<string>("");

export const hasUnsavedChangesAtom = atom<boolean>(false);

export const pageUsersAtom = atom<any[]>([]);

export const pageLockAtom = atom<{ userId: string; userName: string } | null>(null);

export const awarenessAtom = atom<any | null>(null);
