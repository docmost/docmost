import { atom } from 'jotai';

export const showCommentPopupAtom = atom(false);
export const activeCommentIdAtom = atom<string | null>(null);
export const draftCommentIdAtom = atom<string | null>(null);
