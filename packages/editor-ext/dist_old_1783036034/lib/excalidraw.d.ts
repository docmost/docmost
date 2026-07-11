import { Node } from "@tiptap/core";
import type { ResizableNodeViewDirection } from "./resizable-nodeview";
export type ExcalidrawResizeOptions = {
    enabled: boolean;
    directions?: ResizableNodeViewDirection[];
    minWidth?: number;
    minHeight?: number;
    alwaysPreserveAspectRatio?: boolean;
    createCustomHandle?: (direction: ResizableNodeViewDirection) => HTMLElement;
    className?: {
        container?: string;
        wrapper?: string;
        handle?: string;
        resizing?: string;
    };
};
export interface ExcalidrawOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
    resize: ExcalidrawResizeOptions | false;
}
export interface ExcalidrawAttributes {
    src?: string;
    title?: string;
    alt?: string;
    size?: number;
    width?: number | string;
    height?: number;
    aspectRatio?: number;
    align?: string;
    attachmentId?: string;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        excalidraw: {
            setExcalidraw: (attributes?: ExcalidrawAttributes) => ReturnType;
            setExcalidrawAlign: (align: "left" | "center" | "right") => ReturnType;
            setExcalidrawSize: (width: number, height: number) => ReturnType;
        };
    }
}
export declare const Excalidraw: Node<ExcalidrawOptions, any>;
