import { Node } from "@tiptap/core";
export interface PageBreakOptions {
    HTMLAttributes: Record<string, any>;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        pageBreak: {
            setPageBreak: () => ReturnType;
        };
    }
}
export declare const PageBreak: Node<PageBreakOptions, any>;
