import { ContentFormat } from './create-page.dto';
export declare class PageIdDto {
    pageId: string;
}
export declare class SpaceIdDto {
    spaceId: string;
}
export declare class PageHistoryIdDto {
    historyId: string;
}
export declare class PageInfoDto extends PageIdDto {
    includeSpace: boolean;
    includeContent: boolean;
    format?: ContentFormat;
}
export declare class DeletePageDto extends PageIdDto {
    permanentlyDelete?: boolean;
}
