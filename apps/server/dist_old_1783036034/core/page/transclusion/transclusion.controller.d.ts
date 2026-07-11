import { User } from "../../../database/types/entity.types";
import { TransclusionService } from './transclusion.service';
import { LookupDto } from './dto/lookup.dto';
import { ReferencesDto } from './dto/references.dto';
import { UnsyncReferenceDto } from './dto/unsync-reference.dto';
export declare class TransclusionController {
    private readonly transclusionService;
    constructor(transclusionService: TransclusionService);
    lookup(dto: LookupDto, user: User): Promise<{
        items: import("./transclusion.types").TransclusionLookup[];
    }>;
    references(dto: ReferencesDto, user: User): Promise<{
        source: {
            id: string;
            slugId: string;
            title: string | null;
            icon: string | null;
            spaceId: string;
            spaceSlug: string | null;
        } | null;
        references: {
            id: string;
            slugId: string;
            title: string | null;
            icon: string | null;
            spaceId: string;
            spaceSlug: string | null;
        }[];
    }>;
    unsyncReference(dto: UnsyncReferenceDto, user: User): Promise<{
        content: unknown;
    }>;
}
