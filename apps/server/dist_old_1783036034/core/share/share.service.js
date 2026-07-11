"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ShareService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const helpers_1 = require("../../common/helpers");
const page_repo_1 = require("../../database/repos/page/page.repo");
const token_service_1 = require("../auth/services/token.service");
const collaboration_util_1 = require("../../collaboration/collaboration.util");
const utils_1 = require("../../common/helpers/prosemirror/utils");
const share_repo_1 = require("../../database/repos/share/share.repo");
const page_permission_repo_1 = require("../../database/repos/page/page-permission.repo");
const share_util_1 = require("./share.util");
const uuid_1 = require("uuid");
const kysely_1 = require("kysely");
const transclusion_service_1 = require("../page/transclusion/transclusion.service");
let ShareService = ShareService_1 = class ShareService {
    constructor(shareRepo, pageRepo, pagePermissionRepo, db, tokenService, transclusionService) {
        this.shareRepo = shareRepo;
        this.pageRepo = pageRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.db = db;
        this.tokenService = tokenService;
        this.transclusionService = transclusionService;
        this.logger = new common_1.Logger(ShareService_1.name);
    }
    async getShareTree(shareId, workspaceId) {
        const share = await this.shareRepo.findById(shareId);
        if (!share || share.workspaceId !== workspaceId) {
            throw new common_1.NotFoundException('Share not found');
        }
        const isRestricted = await this.pagePermissionRepo.hasRestrictedAncestor(share.pageId);
        if (isRestricted) {
            throw new common_1.NotFoundException('Share not found');
        }
        if (share.includeSubPages) {
            const pageTree = await this.pageRepo.getPageAndDescendantsExcludingRestricted(share.pageId, { includeContent: false });
            return { share, pageTree };
        }
        else {
            return { share, pageTree: [] };
        }
    }
    async createShare(opts) {
        const { authUserId, workspaceId, page, createShareDto } = opts;
        try {
            const shares = await this.shareRepo.findByPageId(page.id);
            if (shares) {
                return shares;
            }
            return await this.shareRepo.insertShare({
                key: (0, helpers_1.nanoIdGen)().toLowerCase(),
                pageId: page.id,
                includeSubPages: createShareDto.includeSubPages ?? false,
                searchIndexing: createShareDto.searchIndexing ?? false,
                creatorId: authUserId,
                spaceId: page.spaceId,
                workspaceId,
            });
        }
        catch (err) {
            this.logger.error(err);
            throw new common_1.BadRequestException('Failed to share page');
        }
    }
    async updateShare(shareId, updateShareDto) {
        try {
            return this.shareRepo.updateShare({
                includeSubPages: updateShareDto.includeSubPages,
                searchIndexing: updateShareDto.searchIndexing,
            }, shareId);
        }
        catch (err) {
            this.logger.error(err);
            throw new common_1.BadRequestException('Failed to update share');
        }
    }
    async getSharedPage(dto, workspaceId) {
        const share = await this.getShareForPage(dto.pageId, workspaceId);
        if (!share) {
            throw new common_1.NotFoundException('Shared page not found');
        }
        const page = await this.pageRepo.findById(dto.pageId, {
            includeContent: true,
            includeCreator: true,
        });
        if (!page || page.deletedAt) {
            throw new common_1.NotFoundException('Shared page not found');
        }
        const isRestricted = await this.pagePermissionRepo.hasRestrictedAncestor(page.id);
        if (isRestricted) {
            throw new common_1.NotFoundException('Shared page not found');
        }
        page.content = await this.updatePublicAttachments(page);
        return { page, share };
    }
    async getShareForPage(pageId, workspaceId) {
        const share = await this.db
            .withRecursive('page_hierarchy', (cte) => cte
            .selectFrom('pages')
            .leftJoin('shares', 'shares.pageId', 'pages.id')
            .select([
            'pages.id',
            'pages.slugId',
            'pages.title',
            'pages.icon',
            'pages.parentPageId',
            (0, kysely_1.sql) `0`.as('level'),
            'shares.id as shareId',
            'shares.key as shareKey',
            'shares.includeSubPages',
            'shares.searchIndexing',
            'shares.creatorId',
            'shares.spaceId',
            'shares.workspaceId',
            'shares.createdAt',
        ])
            .where((0, uuid_1.validate)(pageId) ? 'pages.id' : 'pages.slugId', '=', pageId)
            .where('pages.deletedAt', 'is', null)
            .unionAll((union) => union
            .selectFrom('pages as p')
            .innerJoin('page_hierarchy as ph', 'ph.parentPageId', 'p.id')
            .leftJoin('shares as s', 's.pageId', 'p.id')
            .select([
            'p.id',
            'p.slugId',
            'p.title',
            'p.icon',
            'p.parentPageId',
            (0, kysely_1.sql) `ph.level + 1`.as('level'),
            's.id as shareId',
            's.key as shareKey',
            's.includeSubPages',
            's.searchIndexing',
            's.creatorId',
            's.spaceId',
            's.workspaceId',
            's.createdAt',
        ])
            .where('p.deletedAt', 'is', null)
            .where((0, kysely_1.sql) `ph.share_id`, 'is', null)
            .where((0, kysely_1.sql) `ph.level`, '<', (0, kysely_1.sql) `25`)))
            .selectFrom('page_hierarchy')
            .selectAll()
            .where('shareId', 'is not', null)
            .limit(1)
            .executeTakeFirst();
        if (!share || share.workspaceId !== workspaceId) {
            return undefined;
        }
        if (share.level > 0 && !share.includeSubPages) {
            return undefined;
        }
        return {
            id: share.shareId,
            key: share.shareKey,
            includeSubPages: share.includeSubPages,
            searchIndexing: share.searchIndexing,
            pageId: share.id,
            creatorId: share.creatorId,
            spaceId: share.spaceId,
            workspaceId: share.workspaceId,
            createdAt: share.createdAt,
            level: share.level,
            sharedPage: {
                id: share.id,
                slugId: share.slugId,
                title: share.title,
                icon: share.icon,
            },
        };
    }
    async getShareAncestorPage(ancestorPageId, childPageId) {
        let ancestor = null;
        try {
            ancestor = await this.db
                .withRecursive('page_ancestors', (db) => db
                .selectFrom('pages')
                .select([
                'id',
                'slugId',
                'title',
                'parentPageId',
                'spaceId',
                (eb) => eb
                    .case()
                    .when(eb.ref('id'), '=', ancestorPageId)
                    .then(true)
                    .else(false)
                    .end()
                    .as('found'),
            ])
                .where((0, uuid_1.validate)(childPageId) ? 'id' : 'slugId', '=', childPageId)
                .unionAll((exp) => exp
                .selectFrom('pages as p')
                .select([
                'p.id',
                'p.slugId',
                'p.title',
                'p.parentPageId',
                'p.spaceId',
                (eb) => eb
                    .case()
                    .when(eb.ref('p.id'), '=', ancestorPageId)
                    .then(true)
                    .else(false)
                    .end()
                    .as('found'),
            ])
                .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id')
                .where('pa.found', '=', false)))
                .selectFrom('page_ancestors')
                .selectAll()
                .where('found', '=', true)
                .limit(1)
                .executeTakeFirst();
        }
        catch (err) {
        }
        return ancestor;
    }
    async lookupTransclusionForShare(shareId, references, workspaceId) {
        const share = await this.shareRepo.findById(shareId);
        if (!share || share.workspaceId !== workspaceId) {
            throw new common_1.NotFoundException('Share not found');
        }
        const sharingAllowed = await this.isSharingAllowed(workspaceId, share.spaceId);
        if (!sharingAllowed) {
            throw new common_1.NotFoundException('Share not found');
        }
        const candidatePageIds = Array.from(new Set(references.map((r) => r.sourcePageId)));
        const sharingAllowedCache = new Map();
        sharingAllowedCache.set(share.spaceId, Promise.resolve(true));
        const isSharingAllowedFor = (spaceId) => {
            const cached = sharingAllowedCache.get(spaceId);
            if (cached)
                return cached;
            const p = this.isSharingAllowed(workspaceId, spaceId);
            sharingAllowedCache.set(spaceId, p);
            return p;
        };
        const accessibleResults = await Promise.all(candidatePageIds.map(async (pageId) => {
            const sourceShare = await this.getShareForPage(pageId, workspaceId);
            if (!sourceShare)
                return null;
            if (!(await isSharingAllowedFor(sourceShare.spaceId)))
                return null;
            const restricted = await this.pagePermissionRepo.hasRestrictedAncestor(pageId);
            if (restricted)
                return null;
            return pageId;
        }));
        const accessibleSet = new Set(accessibleResults.filter((id) => id !== null));
        const { items } = await this.transclusionService.lookupWithAccessSet(references, accessibleSet, workspaceId);
        const tokenized = await Promise.all(items.map(async (item) => {
            if ('status' in item)
                return item;
            const doc = await this.prepareContentForShare(item.content, item.sourcePageId, workspaceId);
            return { ...item, content: doc?.toJSON() ?? item.content };
        }));
        const sanitized = tokenized.map((item) => 'status' in item && item.status === 'not_found'
            ? {
                sourcePageId: item.sourcePageId,
                transclusionId: item.transclusionId,
                status: 'no_access',
            }
            : item);
        return { items: sanitized };
    }
    async isSharingAllowed(workspaceId, spaceId) {
        const result = await this.db
            .selectFrom('workspaces')
            .innerJoin('spaces', 'spaces.workspaceId', 'workspaces.id')
            .select([
            'workspaces.settings as workspaceSettings',
            'spaces.settings as spaceSettings',
        ])
            .where('workspaces.id', '=', workspaceId)
            .where('spaces.id', '=', spaceId)
            .executeTakeFirst();
        if (!result)
            return false;
        const workspaceDisabled = result.workspaceSettings?.sharing?.disabled === true;
        const spaceDisabled = result.spaceSettings?.sharing?.disabled === true;
        return !workspaceDisabled && !spaceDisabled;
    }
    async updatePublicAttachments(page) {
        const doc = await this.prepareContentForShare(page.content, page.id, page.workspaceId);
        return doc?.toJSON() ?? page.content;
    }
    async prepareContentForShare(content, attachmentOwnerPageId, workspaceId) {
        const pmJson = (0, utils_1.getProsemirrorContent)(content);
        const attachmentIds = (0, utils_1.getAttachmentIds)(pmJson);
        const tokenMap = new Map();
        await Promise.all(attachmentIds.map(async (attachmentId) => {
            const token = await this.tokenService.generateAttachmentToken({
                attachmentId,
                pageId: attachmentOwnerPageId,
                workspaceId,
            });
            tokenMap.set(attachmentId, token);
        }));
        const doc = (0, collaboration_util_1.jsonToNode)(pmJson);
        doc?.descendants((node) => {
            if (!(0, utils_1.isAttachmentNode)(node.type.name))
                return;
            const token = tokenMap.get(node.attrs.attachmentId);
            if (!token)
                return;
            (0, share_util_1.updateAttachmentAttr)(node, 'src', token);
            (0, share_util_1.updateAttachmentAttr)(node, 'url', token);
        });
        return doc ? (0, utils_1.removeMarkTypeFromDoc)(doc, 'comment') : null;
    }
};
exports.ShareService = ShareService;
exports.ShareService = ShareService = ShareService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [share_repo_1.ShareRepo,
        page_repo_1.PageRepo,
        page_permission_repo_1.PagePermissionRepo, Object, token_service_1.TokenService,
        transclusion_service_1.TransclusionService])
], ShareService);
//# sourceMappingURL=share.service.js.map