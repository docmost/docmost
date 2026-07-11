export declare class SearchDTO {
    query: string;
    spaceId: string;
    shareId?: string;
    creatorId?: string;
    limit?: number;
    offset?: number;
}
export declare class SearchShareDTO extends SearchDTO {
    shareId: string;
    spaceId: string;
}
export declare class SearchSuggestionDTO {
    query: string;
    includeUsers?: boolean;
    includeGroups?: boolean;
    includePages?: boolean;
    spaceId?: string;
    limit?: number;
}
