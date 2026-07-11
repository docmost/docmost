import type { Transaction } from '@tiptap/pm/state';
import type { CellSelectionRange } from './types';
export declare function getSelectionRangeInColumn(tr: Transaction, startColIndex: number, endColIndex?: number): CellSelectionRange | undefined;
