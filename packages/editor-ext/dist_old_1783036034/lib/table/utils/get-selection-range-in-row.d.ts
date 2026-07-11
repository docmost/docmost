import type { Transaction } from '@tiptap/pm/state';
import type { CellSelectionRange } from './types';
export declare function getSelectionRangeInRow(tr: Transaction, startRowIndex: number, endRowIndex?: number): CellSelectionRange | undefined;
