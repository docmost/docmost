export declare enum ExportFormat {
    HTML = "html",
    Markdown = "markdown"
}
export declare class ExportPageDto {
    pageId: string;
    format: ExportFormat;
    includeChildren?: boolean;
    includeAttachments?: boolean;
}
export declare class ExportSpaceDto {
    spaceId: string;
    format: ExportFormat;
    includeAttachments?: boolean;
}
