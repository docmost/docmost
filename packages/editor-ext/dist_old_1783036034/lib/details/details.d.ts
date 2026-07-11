import { Node } from "@tiptap/core";
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        details: {
            setDetails: () => ReturnType;
            unsetDetails: () => ReturnType;
            toggleDetails: () => ReturnType;
        };
    }
}
export interface DetailsOptions {
    HTMLAttributes: Record<string, any>;
}
export declare const Details: Node<DetailsOptions, any>;
