import { Node } from "@tiptap/core";
export interface TransclusionReferenceOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
}
export interface TransclusionReferenceAttributes {
    sourcePageId?: string | null;
    transclusionId?: string | null;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        transclusionReference: {
            insertTransclusionReference: (attributes: TransclusionReferenceAttributes) => ReturnType;
        };
    }
}
export declare const TransclusionReference: Node<TransclusionReferenceOptions, any>;
