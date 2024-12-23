import { atom } from 'jotai';
import { Editor } from '@tiptap/core';
import { WebSocketStatus } from "@hocuspocus/provider";

export const pageEditorAtom = atom<Editor | null>(null);

export const titleEditorAtom = atom<Editor | null>(null);

export const yjsConnectionStatus = atom<string>("");

