import { Node } from "@tiptap/core";
export type PdfOptions = {
    view: any;
    HTMLAttributes: Record<string, any>;
};
export type PdfAttributes = {
    src?: string;
    name?: string;
    attachmentId?: string;
    size?: number;
    width?: number;
    height?: number;
    placeholder?: {
        id: string;
        name: string;
    };
};
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        pdfBlock: {
            setPdf: (attributes: PdfAttributes) => ReturnType;
        };
    }
}
export declare const TiptapPdf: Node<PdfOptions, any>;
