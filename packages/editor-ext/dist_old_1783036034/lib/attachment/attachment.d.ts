import { Node } from "@tiptap/core";
export interface AttachmentOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
}
export interface AttachmentAttributes {
    url?: string;
    name?: string;
    mime?: string;
    size?: number;
    attachmentId?: string;
    placeholder?: string;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        attachment: {
            setAttachment: (attributes: AttachmentAttributes) => ReturnType;
        };
    }
}
export declare const Attachment: Node<AttachmentOptions, any>;
