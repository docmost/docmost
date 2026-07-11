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
var PageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageService = void 0;
const common_1 = require("@nestjs/common");
const page_metadata_dto_1 = require("../dto/page-metadata.dto");
const page_repo_1 = require("../../../database/repos/page/page.repo");
const page_permission_repo_1 = require("../../../database/repos/page/page-permission.repo");
const cursor_pagination_1 = require("../../../database/pagination/cursor-pagination");
const nestjs_kysely_1 = require("nestjs-kysely");
const fractional_indexing_jittered_1 = require("fractional-indexing-jittered");
const helpers_1 = require("../../../common/helpers");
const helpers_2 = require("../../../common/helpers");
const utils_1 = require("../../../database/utils");
const attachment_repo_1 = require("../../../database/repos/attachment/attachment.repo");
const uuid_1 = require("uuid");
const utils_2 = require("../../../common/helpers/prosemirror/utils");
const collaboration_util_1 = require("../../../collaboration/collaboration.util");
const storage_service_1 = require("../../../integrations/storage/storage.service");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const constants_1 = require("../../../integrations/queue/constants");
const event_contants_1 = require("../../../common/events/event.contants");
const event_emitter_1 = require("@nestjs/event-emitter");
const collaboration_gateway_1 = require("../../../collaboration/collaboration.gateway");
const utils_3 = require("../../../integrations/export/utils");
const editor_ext_1 = require("@docmost/editor-ext");
const watcher_service_1 = require("../../watcher/watcher.service");
const kysely_1 = require("kysely");
const transclusion_service_1 = require("../transclusion/transclusion.service");
let PageService = PageService_1 = class PageService {
    constructor(pageRepo, pagePermissionRepo, attachmentRepo, db, storageService, attachmentQueue, aiQueue, generalQueue, eventEmitter, collaborationGateway, watcherService, transclusionService) {
        this.pageRepo = pageRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.attachmentRepo = attachmentRepo;
        this.db = db;
        this.storageService = storageService;
        this.attachmentQueue = attachmentQueue;
        this.aiQueue = aiQueue;
        this.generalQueue = generalQueue;
        this.eventEmitter = eventEmitter;
        this.collaborationGateway = collaborationGateway;
        this.watcherService = watcherService;
        this.transclusionService = transclusionService;
        this.logger = new common_1.Logger(PageService_1.name);
    }
    async findById(pageId, includeContent, includeYdoc, includeSpace) {
        return this.pageRepo.findById(pageId, {
            includeContent,
            includeYdoc,
            includeSpace,
        });
    }
    async create(userId, workspaceId, createPageDto) {
        let parentPageId = undefined;
        if (createPageDto.parentPageId) {
            const parentPage = await this.pageRepo.findById(createPageDto.parentPageId);
            if (!parentPage ||
                parentPage.deletedAt ||
                parentPage.spaceId !== createPageDto.spaceId) {
                throw new common_1.NotFoundException('Parent page not found');
            }
            parentPageId = parentPage.id;
        }
        let content = undefined;
        let textContent = undefined;
        let ydoc = undefined;
        if (createPageDto?.content && createPageDto?.format) {
            const prosemirrorJson = await this.parseProsemirrorContent(createPageDto.content, createPageDto.format);
            content = prosemirrorJson;
            textContent = (0, collaboration_util_1.jsonToText)(prosemirrorJson);
            ydoc = (0, utils_2.createYdocFromJson)(prosemirrorJson);
        }
        const page = await this.pageRepo.insertPage({
            slugId: (0, helpers_1.generateSlugId)(),
            title: createPageDto.title,
            position: await this.nextPagePosition(createPageDto.spaceId, parentPageId),
            icon: createPageDto.icon,
            parentPageId: parentPageId,
            spaceId: createPageDto.spaceId,
            creatorId: userId,
            workspaceId: workspaceId,
            lastUpdatedById: userId,
            content,
            textContent,
            ydoc,
        });
        this.generalQueue
            .add(constants_1.QueueJob.ADD_PAGE_WATCHERS, {
            userIds: [userId],
            pageId: page.id,
            spaceId: createPageDto.spaceId,
            workspaceId,
        })
            .catch((err) => this.logger.warn(`Failed to queue add-page-watchers: ${err.message}`));
        return page;
    }
    async nextPagePosition(spaceId, parentPageId) {
        let pagePosition;
        const lastPageQuery = this.db
            .selectFrom('pages')
            .select(['position'])
            .where('spaceId', '=', spaceId)
            .where('deletedAt', 'is', null)
            .orderBy('position', (ob) => ob.collate('C').desc())
            .limit(1);
        if (parentPageId) {
            const lastPage = await lastPageQuery
                .where('parentPageId', '=', parentPageId)
                .executeTakeFirst();
            if (!lastPage) {
                pagePosition = (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(null, null);
            }
            else {
                pagePosition = (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(lastPage.position, null);
            }
        }
        else {
            const lastPage = await lastPageQuery
                .where('parentPageId', 'is', null)
                .executeTakeFirst();
            if (!lastPage) {
                pagePosition = (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(null, null);
            }
            else {
                pagePosition = (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(lastPage.position, null);
            }
        }
        return pagePosition;
    }
    async update(page, updatePageDto, user) {
        const contributors = new Set(page.contributorIds);
        contributors.add(user.id);
        const contributorIds = Array.from(contributors);
        if (updatePageDto.metadata !== undefined) {
            (0, page_metadata_dto_1.validateMetadata)(updatePageDto.metadata);
        }
        await this.pageRepo.updatePage({
            title: updatePageDto.title,
            icon: updatePageDto.icon,
            lastUpdatedById: user.id,
            updatedAt: new Date(),
            contributorIds: contributorIds,
            metadata: updatePageDto.metadata,
        }, page.id);
        this.generalQueue
            .add(constants_1.QueueJob.ADD_PAGE_WATCHERS, {
            userIds: [user.id],
            pageId: page.id,
            spaceId: page.spaceId,
            workspaceId: page.workspaceId,
        })
            .catch((err) => this.logger.warn(`Failed to queue add-page-watchers: ${err.message}`));
        if (updatePageDto.content &&
            updatePageDto.operation &&
            updatePageDto.format) {
            await this.updatePageContent(page.id, updatePageDto.content, updatePageDto.operation, updatePageDto.format, user);
        }
        return await this.pageRepo.findById(page.id, {
            includeSpace: true,
            includeContent: true,
            includeCreator: true,
            includeLastUpdatedBy: true,
            includeContributors: true,
        });
    }
    async updatePageContent(pageId, content, operation, format, user) {
        const prosemirrorJson = await this.parseProsemirrorContent(content, format);
        const documentName = `page.${pageId}`;
        await this.collaborationGateway.handleYjsEvent('updatePageContent', documentName, { operation, prosemirrorJson, user });
    }
    async getSidebarPages(spaceId, pagination, pageId, userId, spaceCanEdit) {
        let query = this.db
            .selectFrom('pages')
            .select([
            'id',
            'slugId',
            'title',
            'icon',
            'position',
            'parentPageId',
            'spaceId',
            'creatorId',
            'deletedAt',
        ])
            .select((eb) => this.pageRepo.withHasChildren(eb))
            .where('deletedAt', 'is', null)
            .where('spaceId', '=', spaceId);
        if (pageId) {
            query = query.where('parentPageId', '=', pageId);
        }
        else {
            query = query.where('parentPageId', 'is', null);
        }
        const result = await (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                {
                    expression: 'position',
                    direction: 'asc',
                    orderModifier: (ob) => ob.collate('C').asc(),
                    cursorExpression: (0, kysely_1.sql) `position collate "C"`,
                },
                { expression: 'id', direction: 'asc' },
            ],
            parseCursor: (cursor) => ({
                position: cursor.position,
                id: cursor.id,
            }),
        });
        if (userId && result.items.length > 0) {
            const hasRestrictions = await this.pagePermissionRepo.hasRestrictedPagesInSpace(spaceId);
            if (!hasRestrictions) {
                result.items = result.items.map((p) => ({
                    ...p,
                    canEdit: spaceCanEdit ?? true,
                }));
            }
            else {
                const pageIds = result.items.map((p) => p.id);
                const accessiblePages = await this.pagePermissionRepo.filterAccessiblePageIdsWithPermissions(pageIds, userId);
                const permissionMap = new Map(accessiblePages.map((p) => [p.id, p.canEdit]));
                result.items = result.items
                    .filter((p) => permissionMap.has(p.id))
                    .map((p) => ({
                    ...p,
                    canEdit: permissionMap.get(p.id) && (spaceCanEdit ?? true),
                }));
                const pagesWithChildren = result.items.filter((p) => p.hasChildren);
                if (pagesWithChildren.length > 0) {
                    const parentIds = pagesWithChildren.map((p) => p.id);
                    const parentsWithAccessibleChildren = await this.pagePermissionRepo.getParentIdsWithAccessibleChildren(parentIds, userId);
                    const hasAccessibleChildrenSet = new Set(parentsWithAccessibleChildren);
                    result.items = result.items.map((p) => ({
                        ...p,
                        hasChildren: p.hasChildren && hasAccessibleChildrenSet.has(p.id),
                    }));
                }
            }
        }
        return result;
    }
    async movePageToSpace(rootPage, spaceId, userId) {
        let childPageIds = [];
        const allPages = await this.pageRepo.getPageAndDescendants(rootPage.id, {
            includeContent: false,
        });
        const accessiblePages = await this.filterAccessibleTreePages(allPages, rootPage.id, userId, rootPage.spaceId);
        const accessibleIds = new Set(accessiblePages.map((p) => p.id));
        const pagesToOrphan = allPages.filter((p) => !accessibleIds.has(p.id) &&
            p.parentPageId &&
            accessibleIds.has(p.parentPageId));
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            for (const page of pagesToOrphan) {
                const orphanPosition = await this.nextPagePosition(rootPage.spaceId, null);
                await this.pageRepo.updatePage({ parentPageId: null, position: orphanPosition }, page.id, trx);
            }
            const nextPosition = await this.nextPagePosition(spaceId);
            await this.pageRepo.updatePage({ spaceId, parentPageId: null, position: nextPosition }, rootPage.id, trx);
            const pageIdsToMove = accessiblePages.map((p) => p.id);
            childPageIds = pageIdsToMove.filter((id) => id !== rootPage.id);
            if (pageIdsToMove.length > 1) {
                await this.pageRepo.updatePages({ spaceId }, childPageIds, trx);
            }
            if (pageIdsToMove.length > 0) {
                await trx
                    .deleteFrom('pageAccess')
                    .where('pageId', 'in', pageIdsToMove)
                    .execute();
                await trx
                    .updateTable('shares')
                    .set({ spaceId: spaceId })
                    .where('pageId', 'in', pageIdsToMove)
                    .execute();
                await trx
                    .updateTable('comments')
                    .set({ spaceId: spaceId })
                    .where('pageId', 'in', pageIdsToMove)
                    .execute();
                await trx
                    .updateTable('pageVerifications')
                    .set({ spaceId: spaceId })
                    .where('pageId', 'in', pageIdsToMove)
                    .execute();
                await trx
                    .updateTable('notifications')
                    .set({ spaceId: spaceId })
                    .where('pageId', 'in', pageIdsToMove)
                    .execute();
                await this.attachmentRepo.updateAttachmentsByPageId({ spaceId }, pageIdsToMove, trx);
                await this.watcherService.movePageWatchersToSpace(pageIdsToMove, spaceId, {
                    trx,
                });
                await this.aiQueue.add(constants_1.QueueJob.PAGE_MOVED_TO_SPACE, {
                    pageIds: pageIdsToMove,
                    workspaceId: rootPage.workspaceId,
                });
            }
        });
        return { childPageIds };
    }
    async duplicatePage(rootPage, targetSpaceId, authUser) {
        const spaceId = targetSpaceId || rootPage.spaceId;
        const isDuplicateInSameSpace = !targetSpaceId || targetSpaceId === rootPage.spaceId;
        let nextPosition;
        if (isDuplicateInSameSpace) {
            nextPosition = (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(rootPage.position, null);
        }
        else {
            nextPosition = await this.nextPagePosition(spaceId);
        }
        const allPages = await this.pageRepo.getPageAndDescendants(rootPage.id, {
            includeContent: true,
        });
        const pages = await this.filterAccessibleTreePages(allPages, rootPage.id, authUser.id, rootPage.spaceId);
        const pageMap = new Map();
        pages.forEach((page) => {
            pageMap.set(page.id, {
                newPageId: (0, uuid_1.v7)(),
                newSlugId: (0, helpers_1.generateSlugId)(),
                oldSlugId: page.slugId,
            });
        });
        const slugIdMap = new Map();
        for (const [, entry] of pageMap) {
            slugIdMap.set(entry.oldSlugId, entry);
        }
        const attachmentMap = new Map();
        const insertablePages = await Promise.all(pages.map(async (page) => {
            const pageContent = (0, utils_2.getProsemirrorContent)(page.content);
            const pageFromMap = pageMap.get(page.id);
            const doc = (0, collaboration_util_1.jsonToNode)(pageContent);
            const prosemirrorDoc = (0, utils_2.removeMarkTypeFromDoc)(doc, 'comment');
            const attachmentIds = (0, utils_2.getAttachmentIds)(prosemirrorDoc.toJSON());
            if (attachmentIds.length > 0) {
                attachmentIds.forEach((attachmentId) => {
                    const newPageId = pageFromMap.newPageId;
                    const newAttachmentId = (0, uuid_1.v7)();
                    attachmentMap.set(attachmentId, {
                        newPageId: newPageId,
                        oldPageId: page.id,
                        oldAttachmentId: attachmentId,
                        newAttachmentId: newAttachmentId,
                    });
                    prosemirrorDoc.descendants((node) => {
                        if ((0, utils_2.isAttachmentNode)(node.type.name)) {
                            if (node.attrs.attachmentId === attachmentId) {
                                node.attrs.attachmentId = newAttachmentId;
                                if (node.attrs.src) {
                                    node.attrs.src = node.attrs.src.replace(attachmentId, newAttachmentId);
                                }
                                if (node.attrs.src) {
                                    node.attrs.src = node.attrs.src.replace(attachmentId, newAttachmentId);
                                }
                            }
                        }
                    });
                });
            }
            prosemirrorDoc.descendants((node) => {
                if (node.type.name === 'mention' &&
                    node.attrs.entityType === 'page') {
                    const referencedPageId = node.attrs.entityId;
                    if (referencedPageId && pageMap.has(referencedPageId)) {
                        const mappedPage = pageMap.get(referencedPageId);
                        node.attrs.entityId = mappedPage.newPageId;
                        node.attrs.slugId = mappedPage.newSlugId;
                    }
                }
                if (node.type.name === 'transclusionReference') {
                    const sourcePageId = node.attrs.sourcePageId;
                    if (sourcePageId && pageMap.has(sourcePageId)) {
                        const mappedPage = pageMap.get(sourcePageId);
                        node.attrs.sourcePageId = mappedPage.newPageId;
                    }
                }
                for (const mark of node.marks) {
                    if (mark.type.name === 'link' &&
                        mark.attrs.internal &&
                        mark.attrs.href) {
                        const match = mark.attrs.href.match(utils_3.INTERNAL_LINK_REGEX);
                        if (match) {
                            const slugId = (0, utils_3.extractPageSlugId)(match[5]);
                            if (slugId && slugIdMap.has(slugId)) {
                                const mappedPage = slugIdMap.get(slugId);
                                mark.attrs.href = mark.attrs.href.replace(slugId, mappedPage.newSlugId);
                            }
                        }
                    }
                }
            });
            const prosemirrorJson = prosemirrorDoc.toJSON();
            let title = page.title;
            if (isDuplicateInSameSpace && page.id === rootPage.id) {
                const originalTitle = (0, helpers_2.getPageTitle)(page.title);
                title = `Copy of ${originalTitle}`;
            }
            return {
                id: pageFromMap.newPageId,
                slugId: pageFromMap.newSlugId,
                title: title,
                icon: page.icon,
                metadata: page.metadata,
                content: prosemirrorJson,
                textContent: (0, collaboration_util_1.jsonToText)(prosemirrorJson),
                ydoc: (0, utils_2.createYdocFromJson)(prosemirrorJson),
                position: page.id === rootPage.id ? nextPosition : page.position,
                spaceId: spaceId,
                workspaceId: page.workspaceId,
                creatorId: authUser.id,
                lastUpdatedById: authUser.id,
                parentPageId: page.id === rootPage.id
                    ? isDuplicateInSameSpace
                        ? rootPage.parentPageId
                        : null
                    : page.parentPageId
                        ? pageMap.get(page.parentPageId)?.newPageId
                        : null,
            };
        }));
        await this.db.insertInto('pages').values(insertablePages).execute();
        try {
            await this.transclusionService.insertTransclusionsForPages(insertablePages.map((p) => ({
                id: p.id,
                workspaceId: p.workspaceId,
                content: p.content,
            })));
        }
        catch (err) {
            this.logger.error('Failed to insert transclusions for duplicated pages', err);
        }
        try {
            await this.transclusionService.insertReferencesForPages(insertablePages.map((p) => ({
                id: p.id,
                workspaceId: p.workspaceId,
                content: p.content,
            })));
        }
        catch (err) {
            this.logger.error('Failed to insert transclusion references for duplicated pages', err);
        }
        const insertedPageIds = insertablePages.map((page) => page.id);
        this.eventEmitter.emit(event_contants_1.EventName.PAGE_CREATED, {
            pageIds: insertedPageIds,
            workspaceId: authUser.workspaceId,
        });
        const attachmentsIds = Array.from(attachmentMap.keys());
        if (attachmentsIds.length > 0) {
            const attachments = await this.db
                .selectFrom('attachments')
                .selectAll()
                .where('id', 'in', attachmentsIds)
                .where('workspaceId', '=', rootPage.workspaceId)
                .execute();
            for (const attachment of attachments) {
                try {
                    const pageAttachment = attachmentMap.get(attachment.id);
                    if (attachment.pageId !== pageAttachment.oldPageId) {
                        continue;
                    }
                    const newAttachmentId = pageAttachment.newAttachmentId;
                    const newPageId = pageAttachment.newPageId;
                    const newPathFile = attachment.filePath.replace(attachment.id, newAttachmentId);
                    try {
                        await this.storageService.copy(attachment.filePath, newPathFile);
                        await this.db
                            .insertInto('attachments')
                            .values({
                            id: newAttachmentId,
                            type: attachment.type,
                            filePath: newPathFile,
                            fileName: attachment.fileName,
                            fileSize: attachment.fileSize,
                            mimeType: attachment.mimeType,
                            fileExt: attachment.fileExt,
                            creatorId: attachment.creatorId,
                            workspaceId: attachment.workspaceId,
                            pageId: newPageId,
                            spaceId: spaceId,
                        })
                            .execute();
                    }
                    catch (err) {
                        this.logger.error(`Duplicate page: failed to copy attachment ${attachment.id}`, err);
                    }
                }
                catch (err) {
                    this.logger.error(err);
                }
            }
        }
        const newPageId = pageMap.get(rootPage.id).newPageId;
        const duplicatedPage = await this.pageRepo.findById(newPageId, {
            includeSpace: true,
        });
        const hasChildren = pages.length > 1;
        const childPageIds = insertedPageIds.filter((id) => id !== newPageId);
        return {
            ...duplicatedPage,
            hasChildren,
            childPageIds,
        };
    }
    async movePage(dto, movedPage) {
        try {
            (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(dto.position, null);
        }
        catch (err) {
            throw new common_1.BadRequestException('Invalid move position');
        }
        let parentPageId = null;
        if (movedPage.parentPageId === dto.parentPageId) {
            parentPageId = undefined;
        }
        else {
            if (dto.parentPageId) {
                const parentPage = await this.pageRepo.findById(dto.parentPageId);
                if (!parentPage ||
                    parentPage.deletedAt ||
                    parentPage.spaceId !== movedPage.spaceId) {
                    throw new common_1.NotFoundException('Parent page not found');
                }
                parentPageId = parentPage.id;
            }
        }
        await this.pageRepo.updatePage({
            position: dto.position,
            parentPageId: parentPageId,
        }, dto.pageId);
    }
    async getPageBreadCrumbs(childPageId) {
        const ancestors = await this.db
            .withRecursive('page_ancestors', (db) => db
            .selectFrom('pages')
            .select([
            'id',
            'slugId',
            'title',
            'icon',
            'position',
            'parentPageId',
            'spaceId',
            'deletedAt',
        ])
            .where('id', '=', childPageId)
            .where('deletedAt', 'is', null)
            .unionAll((exp) => exp
            .selectFrom('pages as p')
            .select([
            'p.id',
            'p.slugId',
            'p.title',
            'p.icon',
            'p.position',
            'p.parentPageId',
            'p.spaceId',
            'p.deletedAt',
        ])
            .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id')
            .where('p.deletedAt', 'is', null)))
            .selectFrom('page_ancestors')
            .selectAll('page_ancestors')
            .select((eb) => eb
            .exists(eb
            .selectFrom('pages as child')
            .select((0, kysely_1.sql) `1`.as('one'))
            .whereRef('child.parentPageId', '=', 'page_ancestors.id')
            .where('child.deletedAt', 'is', null))
            .as('hasChildren'))
            .execute();
        return ancestors.reverse();
    }
    async getRecentSpacePages(spaceId, userId, pagination) {
        const result = await this.pageRepo.getRecentPagesInSpace(spaceId, pagination);
        if (result.items.length > 0) {
            const pageIds = result.items.map((p) => p.id);
            const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds,
                userId,
                spaceId,
            });
            const accessibleSet = new Set(accessibleIds);
            result.items = result.items.filter((p) => accessibleSet.has(p.id));
        }
        return result;
    }
    async getRecentPages(userId, pagination) {
        const result = await this.pageRepo.getRecentPages(userId, pagination);
        if (result.items.length > 0) {
            const pageIds = result.items.map((p) => p.id);
            const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds,
                userId,
            });
            const accessibleSet = new Set(accessibleIds);
            result.items = result.items.filter((p) => accessibleSet.has(p.id));
        }
        return result;
    }
    async getCreatedByPages(creatorId, requestingUserId, pagination, spaceId) {
        const result = await this.pageRepo.getCreatedByPages(creatorId, requestingUserId, pagination, spaceId);
        if (result.items.length > 0) {
            const pageIds = result.items.map((p) => p.id);
            const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds,
                userId: requestingUserId,
            });
            const accessibleSet = new Set(accessibleIds);
            result.items = result.items.filter((p) => accessibleSet.has(p.id));
        }
        return result;
    }
    async getDeletedSpacePages(spaceId, userId, pagination) {
        const result = await this.pageRepo.getDeletedPagesInSpace(spaceId, pagination);
        if (result.items.length > 0) {
            const pageIds = result.items.map((p) => p.id);
            const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds,
                userId,
                spaceId,
            });
            const accessibleSet = new Set(accessibleIds);
            result.items = result.items.filter((p) => accessibleSet.has(p.id));
        }
        return result;
    }
    async forceDelete(pageId, workspaceId) {
        const descendants = await this.db
            .withRecursive('page_descendants', (db) => db
            .selectFrom('pages')
            .select(['id'])
            .where('id', '=', pageId)
            .unionAll((exp) => exp
            .selectFrom('pages as p')
            .select(['p.id'])
            .innerJoin('page_descendants as pd', 'pd.id', 'p.parentPageId')))
            .selectFrom('page_descendants')
            .selectAll()
            .execute();
        const pageIds = descendants.map((d) => d.id);
        for (const id of pageIds) {
            await this.attachmentQueue.add(constants_1.QueueJob.DELETE_PAGE_ATTACHMENTS, {
                pageId: id,
            }, {
                jobId: `delete-page-attachments-${id}`,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            });
        }
        if (pageIds.length > 0) {
            await this.db.deleteFrom('pages').where('id', 'in', pageIds).execute();
            this.eventEmitter.emit(event_contants_1.EventName.PAGE_DELETED, {
                pageIds: pageIds,
                workspaceId,
            });
        }
    }
    async removePage(pageId, userId, workspaceId) {
        await this.pageRepo.removePage(pageId, userId, workspaceId);
    }
    async parseProsemirrorContent(content, format) {
        let prosemirrorJson;
        switch (format) {
            case 'markdown': {
                const html = await (0, editor_ext_1.markdownToHtml)(content);
                prosemirrorJson = (0, collaboration_util_1.htmlToJson)(html);
                break;
            }
            case 'html': {
                prosemirrorJson = (0, collaboration_util_1.htmlToJson)(content);
                break;
            }
            case 'json':
            default: {
                prosemirrorJson = content;
                break;
            }
        }
        try {
            (0, collaboration_util_1.jsonToNode)(prosemirrorJson);
        }
        catch (err) {
            throw new common_1.BadRequestException('Invalid content format');
        }
        return prosemirrorJson;
    }
    async filterAccessibleTreePages(pages, rootPageId, userId, spaceId) {
        if (pages.length === 0)
            return [];
        const pageIds = pages.map((p) => p.id);
        const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds,
            userId,
            spaceId,
        });
        const accessibleSet = new Set(accessibleIds);
        const includedIds = new Set();
        let changed = true;
        while (changed) {
            changed = false;
            for (const page of pages) {
                if (includedIds.has(page.id))
                    continue;
                if (!accessibleSet.has(page.id))
                    continue;
                if (page.id === rootPageId) {
                    includedIds.add(page.id);
                    changed = true;
                    continue;
                }
                if (page.parentPageId && includedIds.has(page.parentPageId)) {
                    includedIds.add(page.id);
                    changed = true;
                }
            }
        }
        return pages.filter((p) => includedIds.has(p.id));
    }
};
exports.PageService = PageService;
exports.PageService = PageService = PageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, nestjs_kysely_1.InjectKysely)()),
    __param(5, (0, bullmq_1.InjectQueue)(constants_1.QueueName.ATTACHMENT_QUEUE)),
    __param(6, (0, bullmq_1.InjectQueue)(constants_1.QueueName.AI_QUEUE)),
    __param(7, (0, bullmq_1.InjectQueue)(constants_1.QueueName.GENERAL_QUEUE)),
    __metadata("design:paramtypes", [page_repo_1.PageRepo,
        page_permission_repo_1.PagePermissionRepo,
        attachment_repo_1.AttachmentRepo, Object, storage_service_1.StorageService,
        bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        event_emitter_1.EventEmitter2,
        collaboration_gateway_1.CollaborationGateway,
        watcher_service_1.WatcherService,
        transclusion_service_1.TransclusionService])
], PageService);
//# sourceMappingURL=page.service.js.map