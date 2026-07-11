export declare enum FileTaskType {
    Import = "import",
    Export = "export"
}
export declare enum FileImportSource {
    Generic = "generic",
    Notion = "notion",
    Confluence = "confluence"
}
export declare enum FileTaskStatus {
    Processing = "processing",
    Success = "success",
    Failed = "failed"
}
export declare function getFileTaskFolderPath(type: FileTaskType, workspaceId: string): string;
export declare function extractZip(source: string, target: string): Promise<void>;
export declare function cleanUrlString(url: string): string;
