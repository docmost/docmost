import { Node } from "@tiptap/core";
import type { ResizableNodeViewDirection } from "./resizable-nodeview";
export type DrawioResizeOptions = {
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
export interface DrawioOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
    resize: DrawioResizeOptions | false;
}
export interface DrawioAttributes {
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
        drawio: {
            setDrawio: (attributes?: DrawioAttributes) => ReturnType;
            setDrawioAlign: (align: "left" | "center" | "right") => ReturnType;
            setDrawioSize: (width: number, height: number) => ReturnType;
        };
    }
}
export declare const Drawio: Node<DrawioOptions, any>;
