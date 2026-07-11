import { Extension } from '@tiptap/core';
export interface TrailingNodeExtensionOptions {
    node: string;
    notAfter: string[];
}
export declare const TrailingNode: Extension<TrailingNodeExtensionOptions, any>;
