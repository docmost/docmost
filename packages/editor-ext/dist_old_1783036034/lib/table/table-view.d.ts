import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view';
export declare function updateColumns(node: ProseMirrorNode, colgroup: HTMLElement, table: HTMLTableElement, cellMinWidth: number, overrideCol?: number, overrideValue?: number): void;
export declare class TableView implements NodeView {
    node: ProseMirrorNode;
    cellMinWidth: number;
    dom: HTMLDivElement;
    table: HTMLTableElement;
    colgroup: HTMLTableColElement;
    contentDOM: HTMLTableSectionElement;
    constructor(node: ProseMirrorNode, cellMinWidth: number);
    update(node: ProseMirrorNode): boolean;
    ignoreMutation(mutation: ViewMutationRecord): boolean;
}
