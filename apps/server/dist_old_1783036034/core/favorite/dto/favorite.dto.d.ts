export declare class AddFavoriteDto {
    type: 'page' | 'space' | 'template';
    pageId?: string;
    spaceId?: string;
    templateId?: string;
}
export declare class RemoveFavoriteDto extends AddFavoriteDto {
}
