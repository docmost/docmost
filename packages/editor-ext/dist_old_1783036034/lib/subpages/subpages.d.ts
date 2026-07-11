import { Node } from "@tiptap/core";
export interface SubpagesOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
}
export interface SubpagesAttributes {
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        subpages: {
            insertSubpages: (attributes?: SubpagesAttributes) => ReturnType;
        };
    }
}
export declare const Subpages: Node<SubpagesOptions, any>;
