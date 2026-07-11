export type AttachmentRewritePlan = {
    oldAttachmentId: string;
    newAttachmentId: string;
};
export type RewriteResult = {
    content: unknown;
    copies: AttachmentRewritePlan[];
};
export declare function rewriteAttachmentsForUnsync(content: unknown, generateId: () => string): RewriteResult;
