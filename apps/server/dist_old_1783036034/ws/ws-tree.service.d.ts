import { Page } from "../database/types/entity.types";
import { WsService } from './ws.service';
export declare class WsTreeService {
    private readonly wsService;
    constructor(wsService: WsService);
    notifyPageRestricted(page: Page, excludeUserId: string): Promise<void>;
    notifyPermissionGranted(page: Page, userIds: string[]): Promise<void>;
}
