import { Extension } from "@tiptap/core";
declare module "@tiptap/core" {
    interface Storage {
        shared: Record<string, any>;
    }
}
declare const SharedStorage: Extension<any, any>;
export { SharedStorage };
