import type { Transaction } from '@tiptap/pm/state';
export interface MoveColumnParams {
    tr: Transaction;
    originIndex: number;
    targetIndex: number;
    select: boolean;
    pos: number;
}
export declare function moveColumn(moveColParams: MoveColumnParams): boolean;
