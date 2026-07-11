import type { Node, ResolvedPos } from '@tiptap/pm/model';
export type CellPos = {
    pos: number;
    start: number;
    depth: number;
    node: Node;
};
export type CellSelectionRange = {
    $anchor: ResolvedPos;
    $head: ResolvedPos;
    indexes: number[];
};
