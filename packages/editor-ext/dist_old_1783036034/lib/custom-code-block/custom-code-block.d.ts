import type { CodeBlockOptions } from '@tiptap/extension-code-block';
export interface CodeBlockLowlightOptions extends CodeBlockOptions {
    lowlight: any;
    view: any;
}
export declare const CustomCodeBlock: import("@tiptap/core").Node<CodeBlockLowlightOptions, any>;
