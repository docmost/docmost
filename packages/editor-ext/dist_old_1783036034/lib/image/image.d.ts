import { ImageOptions as DefaultImageOptions } from "@tiptap/extension-image";
import { Range } from "@tiptap/core";
import type { ResizableNodeViewDirection } from "../resizable-nodeview";
export type ImageResizeOptions = {
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
export interface ImageOptions extends DefaultImageOptions {
    view: any;
    resize: ImageResizeOptions | false;
}
export interface ImageAttributes {
    src?: string;
    alt?: string;
    align?: string;
    attachmentId?: string;
    size?: number;
    width?: number | string;
    height?: number;
    aspectRatio?: number;
    placeholder?: {
        id: string;
        name: string;
    };
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        imageBlock: {
            setImage: (attributes: ImageAttributes) => ReturnType;
            setImageAt: (attributes: ImageAttributes & {
                pos: number | Range;
            }) => ReturnType;
            setImageAlign: (align: "left" | "center" | "right") => ReturnType;
            setImageWidth: (width: number) => ReturnType;
            setImageSize: (width: number, height: number) => ReturnType;
        };
    }
}
export declare const TiptapImage: import("@tiptap/core").Node<ImageOptions, any>;
