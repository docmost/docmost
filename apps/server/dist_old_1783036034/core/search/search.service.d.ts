import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { KyselyDB } from "../../database/types/kysely.types";
import { PageRepo } from "../../database/repos/page/page.repo";
import { SpaceMemberRepo } from "../../database/repos/space/space-member.repo";
import { ShareRepo } from "../../database/repos/share/share.repo";
import { PagePermissionRepo } from "../../database/repos/page/page-permission.repo";
export declare class SearchService {
    private readonly db;
    private pageRepo;
    private shareRepo;
    private spaceMemberRepo;
    private pagePermissionRepo;
    constructor(db: KyselyDB, pageRepo: PageRepo, shareRepo: ShareRepo, spaceMemberRepo: SpaceMemberRepo, pagePermissionRepo: PagePermissionRepo);
    searchPage(searchParams: SearchDTO, opts: {
        userId?: string;
        workspaceId: string;
    }): Promise<{
        items: SearchResponseDto[];
    }>;
    searchSuggestions(suggestion: SearchSuggestionDTO, userId: string, workspaceId: string): Promise<{
        users: any[];
        groups: any[];
        pages: any[];
    }>;
}
