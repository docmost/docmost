import { User, Workspace } from "../../database/types/entity.types";
import { ShareService } from './share.service';
import { CreateShareDto, ShareIdDto, ShareInfoDto, SharePageIdDto, UpdateShareDto } from './dto/share.dto';
import { ShareTransclusionLookupDto } from './dto/share-transclusion-lookup.dto';
import { PageRepo } from "../../database/repos/page/page.repo";
import { PagePermissionRepo } from "../../database/repos/page/page-permission.repo";
import { PageAccessService } from '../page/page-access/page-access.service';
import { ShareRepo } from "../../database/repos/share/share.repo";
import { PaginationOptions } from "../../database/pagination/pagination-options";
import { LicenseCheckService } from '../../integrations/environment/license-check.service';
import { IAuditService } from '../../integrations/audit/audit.service';
export declare class ShareController {
    private readonly shareService;
    private readonly shareRepo;
    private readonly pageRepo;
    private readonly pagePermissionRepo;
    private readonly pageAccessService;
    private readonly licenseCheckService;
    private readonly auditService;
    constructor(shareService: ShareService, shareRepo: ShareRepo, pageRepo: PageRepo, pagePermissionRepo: PagePermissionRepo, pageAccessService: PageAccessService, licenseCheckService: LicenseCheckService, auditService: IAuditService);
    getShares(user: User, pagination: PaginationOptions): Promise<import("../../database/pagination/cursor-pagination").CursorPaginationResult<{
        key: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        spaceId: string;
        pageId: string;
        includeSubPages: boolean;
        searchIndexing: boolean;
    } & {
        page: {
            id: string;
            title: string;
            icon: string;
            slugId: string;
        };
    } & {
        space: {
            id: string;
            name: string;
            slug: string;
            userRole?: string;
        };
    } & {
        creator: {
            id: string;
            name: string;
            avatarUrl: string;
        };
    }, undefined>>;
    getSharedPageInfo(dto: ShareInfoDto, workspace: Workspace): Promise<{
        features: string[];
        page: {
            id: string;
            workspaceId: string;
            creatorId: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date;
            content: import("../../database/types/db").JsonValue;
            metadata: string | number | boolean | import("../../database/types/db").JsonArray | import("../../database/types/db").JsonObject;
            tsv: string;
            spaceId: string;
            contributorIds: string[];
            coverPhoto: string;
            deletedById: string;
            icon: string;
            isLocked: boolean;
            lastUpdatedById: string;
            parentPageId: string;
            position: string;
            slugId: string;
            textContent: string;
            ydoc: Buffer<ArrayBufferLike>;
        };
        share: {
            id: string;
            key: string;
            includeSubPages: boolean;
            searchIndexing: boolean;
            pageId: string;
            creatorId: string;
            spaceId: string;
            workspaceId: string;
            createdAt: Date;
            level: unknown;
            sharedPage: {
                id: string;
                slugId: string;
                title: string;
                icon: string;
            };
        };
    }>;
    getShare(dto: ShareIdDto): Promise<{
        key: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        spaceId: string;
        pageId: string;
        includeSubPages: boolean;
        searchIndexing: boolean;
    }>;
    transclusionLookup(dto: ShareTransclusionLookupDto, workspace: Workspace): Promise<{
        items: import("../page/transclusion/transclusion.types").TransclusionLookup[];
    }>;
    getShareForPage(dto: SharePageIdDto, user: User, workspace: Workspace): Promise<{
        id: string;
        key: string;
        includeSubPages: boolean;
        searchIndexing: boolean;
        pageId: string;
        creatorId: string;
        spaceId: string;
        workspaceId: string;
        createdAt: Date;
        level: unknown;
        sharedPage: {
            id: string;
            slugId: string;
            title: string;
            icon: string;
        };
    }>;
    create(createShareDto: CreateShareDto, user: User, workspace: Workspace): Promise<{
        key: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        spaceId: string;
        pageId: string;
        includeSubPages: boolean;
        searchIndexing: boolean;
    }>;
    update(updateShareDto: UpdateShareDto, user: User): Promise<{
        key: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        spaceId: string;
        pageId: string;
        includeSubPages: boolean;
        searchIndexing: boolean;
    }>;
    delete(shareIdDto: ShareIdDto, user: User): Promise<void>;
    getSharePageTree(dto: ShareIdDto, workspace: Workspace): Promise<{
        features: string[];
        share: {
            key: string;
            id: string;
            workspaceId: string;
            creatorId: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date;
            spaceId: string;
            pageId: string;
            includeSubPages: boolean;
            searchIndexing: boolean;
        };
        pageTree: {
            id: string;
            workspaceId: string;
            title: string;
            spaceId: string;
            icon: string;
            parentPageId: string;
            position: string;
            slugId: string;
            content?: import("../../database/types/db").JsonValue;
        }[];
    }>;
}
