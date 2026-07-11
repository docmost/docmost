import { Node } from "@tiptap/core";
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        mathInline: {
            setMathInline: () => ReturnType;
        };
    }
}
export interface MathInlineOption {
    HTMLAttributes: Record<string, any>;
    view: any;
}
export interface MathInlineAttributes {
    text: string;
}
export declare const inputRegex: RegExp;
export declare const MathInline: Node<MathInlineOption, any>;
