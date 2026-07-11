import { Node } from "@tiptap/core";
export interface AudioOptions {
    view: any;
    HTMLAttributes: Record<string, any>;
}
export interface AudioAttributes {
    src?: string;
    attachmentId?: string;
    size?: number;
    placeholder?: {
        id: string;
        name: string;
    };
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        audioBlock: {
            setAudio: (attributes: AudioAttributes) => ReturnType;
        };
    }
}
export declare const TiptapAudio: Node<AudioOptions, any>;
