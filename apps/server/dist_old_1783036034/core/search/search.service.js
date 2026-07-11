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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const kysely_1 = require("kysely");
const page_repo_1 = require("../../database/repos/page/page.repo");
const space_member_repo_1 = require("../../database/repos/space/space-member.repo");
const share_repo_1 = require("../../database/repos/share/share.repo");
const page_permission_repo_1 = require("../../database/repos/page/page-permission.repo");
const tsquery = require('pg-tsquery')();
let SearchService = class SearchService {
    constructor(db, pageRepo, shareRepo, spaceMemberRepo, pagePermissionRepo) {
        this.db = db;
        this.pageRepo = pageRepo;
        this.shareRepo = shareRepo;
        this.spaceMemberRepo = spaceMemberRepo;
        this.pagePermissionRepo = pagePermissionRepo;
    }
    async searchPage(searchParams, opts) {
        const { query } = searchParams;
        if (query.length < 1) {
            return { items: [] };
        }
        const searchQuery = tsquery(query.trim() + '*');
        let queryResults = this.db
            .selectFrom('pages')
            .select([
            'id',
            'slugId',
            'title',
            'icon',
            'parentPageId',
            'creatorId',
            'createdAt',
            'updatedAt',
            (0, kysely_1.sql) `ts_rank(tsv, to_tsquery('english', f_unaccent(${searchQuery})))`.as('rank'),
            (0, kysely_1.sql) `ts_headline('english', text_content, to_tsquery('english', f_unaccent(${searchQuery})),'MinWords=9, MaxWords=10, MaxFragments=3')`.as('highlight'),
        ])
            .where('tsv', '@@', (0, kysely_1.sql) `to_tsquery('english', f_unaccent(${searchQuery}))`)
            .$if(Boolean(searchParams.creatorId), (qb) => qb.where('creatorId', '=', searchParams.creatorId))
            .where('deletedAt', 'is', null)
            .orderBy('rank', 'desc')
            .limit(searchParams.limit || 25)
            .offset(searchParams.offset || 0);
        if (!searchParams.shareId) {
            queryResults = queryResults.select((eb) => this.pageRepo.withSpace(eb));
        }
        if (searchParams.spaceId) {
            queryResults = queryResults.where('spaceId', '=', searchParams.spaceId);
        }
        else if (opts.userId && !searchParams.spaceId) {
            queryResults = queryResults
                .where('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(opts.userId))
                .where('workspaceId', '=', opts.workspaceId);
        }
        else if (searchParams.shareId && !searchParams.spaceId && !opts.userId) {
            const shareId = searchParams.shareId;
            const share = await this.shareRepo.findById(shareId);
            if (!share || share.workspaceId !== opts.workspaceId) {
                return { items: [] };
            }
            const isRestricted = await this.pagePermissionRepo.hasRestrictedAncestor(share.pageId);
            if (isRestricted) {
                return { items: [] };
            }
            const pageIdsToSearch = [];
            if (share.includeSubPages) {
                const pageList = await this.pageRepo.getPageAndDescendantsExcludingRestricted(share.pageId, {
                    includeContent: false,
                });
                pageIdsToSearch.push(...pageList.map((page) => page.id));
            }
            else {
                pageIdsToSearch.push(share.pageId);
            }
            if (pageIdsToSearch.length > 0) {
                queryResults = queryResults
                    .where('id', 'in', pageIdsToSearch)
                    .where('workspaceId', '=', opts.workspaceId);
            }
            else {
                return { items: [] };
            }
        }
        else {
            return { items: [] };
        }
        let results = await queryResults.execute();
        if (opts.userId && results.length > 0) {
            const pageIds = results.map((r) => r.id);
            const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds,
                userId: opts.userId,
                spaceId: searchParams.spaceId,
            });
            const accessibleSet = new Set(accessibleIds);
            results = results.filter((r) => accessibleSet.has(r.id));
        }
        const searchResults = results.map((result) => {
            if (result.highlight) {
                result.highlight = result.highlight
                    .replace(/\r\n|\r|\n/g, ' ')
                    .replace(/\s+/g, ' ');
            }
            return result;
        });
        return { items: searchResults };
    }
    async searchSuggestions(suggestion, userId, workspaceId) {
        let users = [];
        let groups = [];
        let pages = [];
        const limit = suggestion?.limit || 10;
        const query = suggestion.query.toLowerCase().trim();
        if (suggestion.includeUsers) {
            const userQuery = this.db
                .selectFrom('users')
                .select(['id', 'name', 'email', 'avatarUrl'])
                .where('workspaceId', '=', workspaceId)
                .where('deletedAt', 'is', null)
                .where((eb) => eb.or([
                eb((0, kysely_1.sql) `LOWER(f_unaccent(users.name))`, 'like', (0, kysely_1.sql) `LOWER(f_unaccent(${`%${query}%`}))`),
                eb((0, kysely_1.sql) `users.email`, 'ilike', (0, kysely_1.sql) `f_unaccent(${`%${query}%`})`),
            ]))
                .limit(limit);
            users = await userQuery.execute();
        }
        if (suggestion.includeGroups) {
            groups = await this.db
                .selectFrom('groups')
                .select(['id', 'name', 'description'])
                .where((eb) => eb((0, kysely_1.sql) `LOWER(f_unaccent(groups.name))`, 'like', (0, kysely_1.sql) `LOWER(f_unaccent(${`%${query}%`}))`))
                .where('workspaceId', '=', workspaceId)
                .limit(limit)
                .execute();
        }
        if (suggestion.includePages) {
            let pageSearch = this.db
                .selectFrom('pages')
                .select(['id', 'slugId', 'title', 'icon', 'spaceId'])
                .select((eb) => this.pageRepo.withSpace(eb))
                .where((eb) => eb((0, kysely_1.sql) `LOWER(f_unaccent(pages.title))`, 'like', (0, kysely_1.sql) `LOWER(f_unaccent(${`%${query}%`}))`))
                .where('deletedAt', 'is', null)
                .where('workspaceId', '=', workspaceId)
                .limit(limit);
            const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
            if (userSpaceIds?.length > 0) {
                pageSearch = pageSearch.where('spaceId', 'in', userSpaceIds);
                if (suggestion?.spaceId) {
                    pageSearch = pageSearch.orderBy((0, kysely_1.sql) `CASE WHEN pages."space_id" = ${suggestion.spaceId} THEN 0 ELSE 1 END`, 'asc');
                }
                pages = await pageSearch.execute();
            }
            if (pages.length > 0) {
                const pageIds = pages.map((p) => p.id);
                const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                    pageIds,
                    userId,
                });
                const accessibleSet = new Set(accessibleIds);
                pages = pages.filter((p) => accessibleSet.has(p.id));
            }
        }
        return { users, groups, pages };
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, page_repo_1.PageRepo,
        share_repo_1.ShareRepo,
        space_member_repo_1.SpaceMemberRepo,
        page_permission_repo_1.PagePermissionRepo])
], SearchService);
//# sourceMappingURL=search.service.js.map