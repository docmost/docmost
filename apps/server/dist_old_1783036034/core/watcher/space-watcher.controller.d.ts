import { WatcherService } from './watcher.service';
import { User, Workspace } from "../../database/types/entity.types";
import { SpaceWatcherDto } from './dto/space-watcher.dto';
import { SpaceRepo } from "../../database/repos/space/space.repo";
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
export declare class SpaceWatcherController {
    private readonly watcherService;
    private readonly spaceRepo;
    private readonly spaceAbility;
    constructor(watcherService: WatcherService, spaceRepo: SpaceRepo, spaceAbility: SpaceAbilityFactory);
    private loadSpaceAndAuthorize;
    getWatchedSpaceIds(user: User, workspace: Workspace): Promise<{
        items: string[];
        meta: {
            limit: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
            nextCursor: string | null;
            prevCursor: string | null;
        };
    }>;
    watchSpace(dto: SpaceWatcherDto, user: User, workspace: Workspace): Promise<{
        watching: boolean;
    }>;
    unwatchSpace(dto: SpaceWatcherDto, user: User, workspace: Workspace): Promise<{
        watching: boolean;
    }>;
    getWatchStatus(dto: SpaceWatcherDto, user: User, workspace: Workspace): Promise<{
        watching: boolean;
    }>;
}
