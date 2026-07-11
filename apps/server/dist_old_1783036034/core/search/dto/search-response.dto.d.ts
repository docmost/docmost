import { Space } from "../../../database/types/entity.types";
export declare class SearchResponseDto {
    id: string;
    title: string;
    icon: string;
    parentPageId: string;
    creatorId: string;
    rank: number;
    highlight: string;
    createdAt: Date;
    updatedAt: Date;
    space: Partial<Space>;
}
