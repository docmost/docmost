import { BacklinkRepo } from "../../../database/repos/backlink/backlink.repo";
import { PagePermissionRepo } from "../../../database/repos/page/page-permission.repo";
import { PaginationOptions } from "../../../database/pagination/pagination-options";
export type BacklinkDirection = 'incoming' | 'outgoing';
export declare class BacklinkService {
    private readonly backlinkRepo;
    private readonly pagePermissionRepo;
    constructor(backlinkRepo: BacklinkRepo, pagePermissionRepo: PagePermissionRepo);
    countByPageId(pageId: string, userId: string): Promise<{
        incoming: number;
        outgoing: number;
    }>;
    findByPageId(pageId: string, direction: BacklinkDirection, userId: string, pagination: PaginationOptions): Promise<import("../../../database/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        slugId: string;
        title: string | null;
        icon: string | null;
        spaceId: string;
        updatedAt: Date;
        space: {
            id: string;
            slug: string;
            name: string;
        };
    }, undefined>>;
    private accessibleRelatedIds;
}
