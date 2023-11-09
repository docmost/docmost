import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { IComment } from '@/features/comment/types/comment.types';

export const commentsAtom = atomFamily((pageId: string) => atom<IComment[]>([]));
export const showCommentPopupAtom = atom(false);
export const activeCommentIdAtom = atom<string | null>(null);
export const draftCommentIdAtom = atom<string | null>(null);

export const deleteCommentAtom = atomFamily((pageId: string) => atom(
  null,
  (get, set, idToDelete: string) => {
    const currentPageComments = get(commentsAtom(pageId));
    const updatedComments = currentPageComments.filter(comment => comment.id !== idToDelete);
    set(commentsAtom(pageId), updatedComments);
  }
));
