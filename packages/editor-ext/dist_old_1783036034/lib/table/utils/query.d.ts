import type { Node, ResolvedPos } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
export declare function isCellSelection(value: unknown): value is CellSelection;
export declare function findTable($pos: ResolvedPos): FindParentNodeResult | undefined;
export declare function findCellRange(selection: Selection, anchorHit?: number, headHit?: number): [ResolvedPos, ResolvedPos] | undefined;
export declare function findCellPos(doc: Node, pos: number): ResolvedPos | undefined;
export interface FindParentNodeResult {
    node: Node;
    pos: number;
    start: number;
    depth: number;
}
export declare function findParentNode(predicate: (node: Node) => boolean, $pos: ResolvedPos): FindParentNodeResult | undefined;
