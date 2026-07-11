import { SearchService } from './search.service';
import { SearchDTO, SearchShareDTO, SearchSuggestionDTO } from './dto/search.dto';
import { User, Workspace } from "../../database/types/entity.types";
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { ModuleRef } from '@nestjs/core';
export declare class SearchController {
    private readonly searchService;
    private readonly spaceAbility;
    private readonly environmentService;
    private moduleRef;
    private readonly logger;
    constructor(searchService: SearchService, spaceAbility: SpaceAbilityFactory, environmentService: EnvironmentService, moduleRef: ModuleRef);
    pageSearch(searchDto: SearchDTO, user: User, workspace: Workspace): Promise<any>;
    searchSuggestions(dto: SearchSuggestionDTO, user: User, workspace: Workspace): Promise<{
        users: any[];
        groups: any[];
        pages: any[];
    }>;
    searchShare(searchDto: SearchShareDTO, workspace: Workspace): Promise<any>;
    searchTypesense(searchParams: SearchDTO, opts: {
        userId?: string;
        workspaceId: string;
    }): Promise<any>;
}
