import { Editor } from "@tiptap/core";
export declare function normalizeFileUrl(src: string): string;
export type UploadFn = (file: File, editor: Editor, pos: number, pageId: string, allowMedia?: boolean) => void;
export interface MediaUploadOptions {
    validateFn?: (file: File, allowMedia?: boolean) => void;
    onUpload: (file: File, pageId: string) => Promise<any>;
}
