export type ContentFormat = 'json' | 'markdown' | 'html';
export declare class CreatePageDto {
    title?: string;
    icon?: string;
    parentPageId?: string;
    spaceId: string;
    content?: string | object;
    format?: ContentFormat;
}
