import { Node } from "@tiptap/core";
export interface ColumnOptions {
    HTMLAttributes: Record<string, any>;
}
export interface ColumnAttributes {
    width?: number | null;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        column: {
            setColumnWidth: (width: number | null) => ReturnType;
        };
    }
}
export declare const Column: Node<ColumnOptions, any>;
