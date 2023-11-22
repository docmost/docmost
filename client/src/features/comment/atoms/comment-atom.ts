import { atom } from 'jotai';

export const showCommentPopupAtom = atom<boolean>(false);
export const activeCommentIdAtom = atom<string>('');
export const draftCommentIdAtom = atom<string>('');
