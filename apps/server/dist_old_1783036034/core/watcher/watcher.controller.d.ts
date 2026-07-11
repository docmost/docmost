import { WatcherService } from './watcher.service';
import { User, Workspace } from "../../database/types/entity.types";
import { WatcherPageDto } from './dto/watcher.dto';
import { PageRepo } from "../../database/repos/page/page.repo";
import { PageAccessService } from '../page/page-access/page-access.service';
export declare class WatcherController {
    private readonly watcherService;
    private readonly pageRepo;
    private readonly pageAccessService;
    constructor(watcherService: WatcherService, pageRepo: PageRepo, pageAccessService: PageAccessService);
    watchPage(dto: WatcherPageDto, user: User, workspace: Workspace): Promise<{
        watching: boolean;
    }>;
    unwatchPage(dto: WatcherPageDto, user: User): Promise<{
        watching: boolean;
    }>;
    getWatchStatus(dto: WatcherPageDto, user: User): Promise<{
        watching: boolean;
    }>;
}
