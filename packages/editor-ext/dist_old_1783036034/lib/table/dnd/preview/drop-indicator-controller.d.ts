import { DraggingDOMs } from "../utils";
export declare class DropIndicatorController {
    private _dropIndicator;
    constructor();
    get dropIndicatorRoot(): HTMLElement;
    onDragStart: (relatedDoms: DraggingDOMs, type: "col" | "row") => void;
    onDragEnd: () => void;
    onDragging: (target: Element, direction: "left" | "right" | "up" | "down", type: "col" | "row") => void;
    destroy: () => void;
    private _initDropIndicatorStyle;
    private _initDropIndicatorPosition;
}
