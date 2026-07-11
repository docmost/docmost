import { Range, Node } from "@tiptap/core";
import type { ResizableNodeViewDirection } from "../resizable-nodeview";
export type VideoResizeOptions = {
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
export interface VideoOptions {
    view: any;
    HTMLAttributes: Record<string, any>;
    resize: VideoResizeOptions | false;
}
export interface VideoAttributes {
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
        videoBlock: {
            setVideo: (attributes: VideoAttributes) => ReturnType;
            setVideoAt: (attributes: VideoAttributes & {
                pos: number | Range;
            }) => ReturnType;
            setVideoAlign: (align: "left" | "center" | "right") => ReturnType;
            setVideoWidth: (width: number) => ReturnType;
            setVideoSize: (width: number, height: number) => ReturnType;
        };
    }
}
export declare const TiptapVideo: Node<VideoOptions, any>;
