import { Extension } from '@tiptap/core';
export type IndentOptions = {
    types: string[];
    min: number;
    max: number;
};
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        indent: {
            indent: () => ReturnType;
            outdent: () => ReturnType;
        };
    }
}
export declare const Indent: Extension<IndentOptions, any>;
