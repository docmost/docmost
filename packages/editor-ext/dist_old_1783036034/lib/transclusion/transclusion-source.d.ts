import { Node } from "@tiptap/core";
export interface TransclusionSourceOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
}
export interface TransclusionSourceAttributes {
    id?: string | null;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        transclusionSource: {
            insertTransclusionSource: (attributes?: TransclusionSourceAttributes) => ReturnType;
            toggleTransclusionSource: () => ReturnType;
            unsyncTransclusionSource: () => ReturnType;
        };
    }
}
export declare const TransclusionSource: Node<TransclusionSourceOptions, any>;
