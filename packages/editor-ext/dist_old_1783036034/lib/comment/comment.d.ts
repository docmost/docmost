import { Mark } from "@tiptap/core";
export interface ICommentOptions {
    HTMLAttributes: Record<string, any>;
}
export interface ICommentStorage {
    activeCommentId: string | null;
}
export declare const commentMarkClass = "comment-mark";
export declare const commentDecorationMetaKey = "decorateComment";
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        comment: {
            setCommentDecoration: () => ReturnType;
            unsetCommentDecoration: () => ReturnType;
            setComment: (commentId: string) => ReturnType;
            unsetComment: (commentId: string) => ReturnType;
            setCommentResolved: (commentId: string, resolved: boolean) => ReturnType;
        };
    }
}
export declare const Comment: Mark<ICommentOptions, ICommentStorage>;
