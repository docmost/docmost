import type { Transaction } from '@tiptap/pm/state';
export interface MoveRowParams {
    tr: Transaction;
    originIndex: number;
    targetIndex: number;
    select: boolean;
    pos: number;
}
export declare function moveRow(moveRowParams: MoveRowParams): boolean;
