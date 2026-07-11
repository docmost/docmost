export declare class DuplicatePageDto {
    pageId: string;
    spaceId?: string;
}
export type CopyPageMapEntry = {
    newPageId: string;
    newSlugId: string;
    oldSlugId: string;
};
export type ICopyPageAttachment = {
    newPageId: string;
    oldPageId: string;
    oldAttachmentId: string;
    newAttachmentId: string;
};
