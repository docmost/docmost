import { CreateShareDto, ShareInfoDto, UpdateShareDto } from './dto/share.dto';
import { KyselyDB } from "../../database/types/kysely.types";
import { PageRepo } from "../../database/repos/page/page.repo";
import { TokenService } from '../auth/services/token.service';
import { ShareRepo } from "../../database/repos/share/share.repo";
import { PagePermissionRepo } from "../../database/repos/page/page-permission.repo";
import { Page } from "../../database/types/entity.types";
import { TransclusionService } from '../page/transclusion/transclusion.service';
import { TransclusionLookup } from '../page/transclusion/transclusion.types';
export declare class ShareService {
    private readonly shareRepo;
    private readonly pageRepo;
    private readonly pagePermissionRepo;
    private readonly db;
    private readonly tokenService;
    private readonly transclusionService;
    private readonly logger;
    constructor(shareRepo: ShareRepo, pageRepo: PageRepo, pagePermissionRepo: PagePermissionRepo, db: KyselyDB, tokenService: TokenService, transclusionService: TransclusionService);
    getShareTree(shareId: string, workspaceId: string): Promise<{
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
    createShare(opts: {
        authUserId: string;
        workspaceId: string;
        page: Page;
        createShareDto: CreateShareDto;
    }): Promise<{
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
    updateShare(shareId: string, updateShareDto: UpdateShareDto): Promise<{
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
    getSharedPage(dto: ShareInfoDto, workspaceId: string): Promise<{
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
    getShareForPage(pageId: string, workspaceId: string): Promise<{
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
    getShareAncestorPage(ancestorPageId: string, childPageId: string): Promise<any>;
    lookupTransclusionForShare(shareId: string, references: Array<{
        sourcePageId: string;
        transclusionId: string;
    }>, workspaceId: string): Promise<{
        items: TransclusionLookup[];
    }>;
    isSharingAllowed(workspaceId: string, spaceId: string): Promise<boolean>;
    updatePublicAttachments(page: Page): Promise<any>;
    private prepareContentForShare;
}
