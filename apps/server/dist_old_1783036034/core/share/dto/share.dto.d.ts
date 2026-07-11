export declare class CreateShareDto {
    pageId: string;
    includeSubPages: boolean;
    searchIndexing: boolean;
}
export declare class UpdateShareDto extends CreateShareDto {
    shareId: string;
    pageId: string;
}
export declare class ShareIdDto {
    shareId: string;
}
export declare class SpaceIdDto {
    spaceId: string;
}
export declare class ShareInfoDto {
    shareId?: string;
    pageId: string;
}
export declare class SharePageIdDto {
    pageId: string;
}
