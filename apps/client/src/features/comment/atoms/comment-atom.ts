import { atom } from 'jotai';

export const showCommentPopupAtom = atom<boolean>(false);
export const activeCommentIdAtom = atom<string>('');
export const draftCommentIdAtom = atom<string>('');

// Read-only comment state
export const showReadOnlyCommentPopupAtom = atom<boolean>(false);
export type YjsSelection = {
  anchor: any;
  head: any;
};
export type ReadOnlyCommentData = {
  yjsSelection: YjsSelection;
  selectedText: string;
};
export const readOnlyCommentDataAtom = atom<ReadOnlyCommentData | null>(null);
