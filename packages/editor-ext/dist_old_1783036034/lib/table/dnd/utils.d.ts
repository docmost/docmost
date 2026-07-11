import { ResolvedPos } from "@tiptap/pm/model";
import { EditorView } from "@tiptap/pm/view";
export declare function getHoveringCell(view: EditorView, event: MouseEvent): HoveringCellInfo | undefined;
export declare function cellInfoFromResolvedCell($cellPos: ResolvedPos): HoveringCellInfo;
export interface HoveringCellInfo {
    rowIndex: number;
    colIndex: number;
    cellPos: number;
    rowFirstCellPos: number;
    colFirstCellPos: number;
}
export type DraggingDOMs = {
    table: HTMLTableElement;
    cell: HTMLTableCellElement;
};
export declare function getDndRelatedDOMs(view: EditorView, cellPos: number | undefined, draggingIndex: number, direction: 'row' | 'col'): DraggingDOMs | undefined;
