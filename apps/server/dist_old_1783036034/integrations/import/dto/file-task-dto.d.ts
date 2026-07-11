export declare class FileTaskIdDto {
    fileTaskId: string;
}
export type ImportPageNode = {
    id: string;
    slugId: string;
    name: string;
    content: string;
    position?: string | null;
    parentPageId: string | null;
    fileExtension: string;
    filePath: string;
    icon?: string | null;
};
