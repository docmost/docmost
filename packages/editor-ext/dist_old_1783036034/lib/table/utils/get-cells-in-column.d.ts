import type { Selection } from '@tiptap/pm/state';
import type { CellPos } from './types';
export declare function getCellsInColumn(columnIndexes: number | number[], selection: Selection): CellPos[] | undefined;
