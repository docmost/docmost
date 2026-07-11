import { DraggingDOMs } from "../utils";
export declare class PreviewController {
    private _preview;
    constructor();
    get previewRoot(): HTMLElement;
    onDragStart: (relatedDoms: DraggingDOMs, index: number | undefined, type: "col" | "row") => void;
    onDragEnd: () => void;
    onDragging: (relatedDoms: DraggingDOMs, x: number, y: number, type: "col" | "row") => void;
    destroy: () => void;
    private _initPreviewStyle;
    private _initPreviewPosition;
    private _updatePreviewPosition;
}
