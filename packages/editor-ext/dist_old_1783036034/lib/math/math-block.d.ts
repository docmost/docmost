import { Node } from "@tiptap/core";
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        mathBlock: {
            setMathBlock: () => ReturnType;
        };
    }
}
export interface MathBlockOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
}
export interface MathBlockAttributes {
    text: string;
}
export declare const inputRegex: RegExp;
export declare const MathBlock: Node<any, any>;
