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
var TransclusionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransclusionService = void 0;
const common_1 = require("@nestjs/common");
const node_util_1 = require("node:util");
const uuid_1 = require("uuid");
const nestjs_kysely_1 = require("nestjs-kysely");
const page_transclusions_repo_1 = require("../../../database/repos/page-transclusions/page-transclusions.repo");
const page_transclusion_references_repo_1 = require("../../../database/repos/page-transclusions/page-transclusion-references.repo");
const page_repo_1 = require("../../../database/repos/page/page.repo");
const page_permission_repo_1 = require("../../../database/repos/page/page-permission.repo");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
const attachment_repo_1 = require("../../../database/repos/attachment/attachment.repo");
const storage_service_1 = require("../../../integrations/storage/storage.service");
const transclusion_prosemirror_util_1 = require("./utils/transclusion-prosemirror.util");
const transclusion_unsync_util_1 = require("./utils/transclusion-unsync.util");
const page_access_service_1 = require("../page-access/page-access.service");
let TransclusionService = TransclusionService_1 = class TransclusionService {
    constructor(db, pageTransclusionsRepo, pageTransclusionReferencesRepo, pageRepo, pagePermissionRepo, spaceMemberRepo, attachmentRepo, storageService, pageAccessService) {
        this.db = db;
        this.pageTransclusionsRepo = pageTransclusionsRepo;
        this.pageTransclusionReferencesRepo = pageTransclusionReferencesRepo;
        this.pageRepo = pageRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.spaceMemberRepo = spaceMemberRepo;
        this.attachmentRepo = attachmentRepo;
        this.storageService = storageService;
        this.pageAccessService = pageAccessService;
        this.logger = new common_1.Logger(TransclusionService_1.name);
    }
    async syncPageTransclusions(pageId, workspaceId, pmJson, trx) {
        const desired = (0, transclusion_prosemirror_util_1.collectTransclusionsFromPmJson)(pmJson);
        const desiredById = new Map(desired.map((d) => [d.transclusionId, d]));
        const existing = await this.pageTransclusionsRepo.findByPageId(pageId, trx);
        const existingById = new Map(existing.map((e) => [e.transclusionId, e]));
        let inserted = 0;
        let updated = 0;
        let deleted = 0;
        for (const d of desired) {
            const prev = existingById.get(d.transclusionId);
            if (!prev) {
                await this.pageTransclusionsRepo.insert({
                    workspaceId,
                    pageId,
                    transclusionId: d.transclusionId,
                    content: d.content,
                }, trx);
                inserted += 1;
                continue;
            }
            const contentChanged = !(0, node_util_1.isDeepStrictEqual)(prev.content, d.content);
            if (contentChanged) {
                await this.pageTransclusionsRepo.update(pageId, d.transclusionId, { content: d.content }, trx);
                updated += 1;
            }
        }
        const removedIds = existing
            .filter((e) => !desiredById.has(e.transclusionId))
            .map((e) => e.transclusionId);
        if (removedIds.length > 0) {
            await this.pageTransclusionsRepo.deleteByPageAndTransclusionIds(pageId, removedIds, trx);
            deleted = removedIds.length;
        }
        return { inserted, updated, deleted };
    }
    async syncPageReferences(referencePageId, workspaceId, pmJson, trx) {
        const desired = (0, transclusion_prosemirror_util_1.collectReferencesFromPmJson)(pmJson);
        const keyOf = (s) => `${s.sourcePageId}::${s.transclusionId}`;
        const desiredKeys = new Set(desired.map(keyOf));
        const existing = await this.pageTransclusionReferencesRepo.findByReferencePageId(referencePageId, trx);
        const existingKeys = new Set(existing.map(keyOf));
        const toInsert = desired
            .filter((d) => !existingKeys.has(keyOf(d)))
            .map((d) => ({
            workspaceId,
            referencePageId,
            sourcePageId: d.sourcePageId,
            transclusionId: d.transclusionId,
        }));
        const toDelete = existing
            .filter((e) => !desiredKeys.has(keyOf(e)))
            .map((e) => ({
            sourcePageId: e.sourcePageId,
            transclusionId: e.transclusionId,
        }));
        if (toInsert.length > 0) {
            await this.pageTransclusionReferencesRepo.insertMany(toInsert, trx);
        }
        if (toDelete.length > 0) {
            await this.pageTransclusionReferencesRepo.deleteByReferenceAndKeys(referencePageId, toDelete, trx);
        }
        return {
            inserted: toInsert.length,
            deleted: toDelete.length,
        };
    }
    async insertTransclusionsForPages(pages, trx) {
        const rows = [];
        for (const page of pages) {
            const snapshots = (0, transclusion_prosemirror_util_1.collectTransclusionsFromPmJson)(page.content);
            for (const s of snapshots) {
                rows.push({
                    workspaceId: page.workspaceId,
                    pageId: page.id,
                    transclusionId: s.transclusionId,
                    content: s.content,
                });
            }
        }
        if (rows.length === 0)
            return { inserted: 0 };
        await this.pageTransclusionsRepo.insertMany(rows, trx);
        return { inserted: rows.length };
    }
    async insertReferencesForPages(pages, trx) {
        const rows = [];
        for (const page of pages) {
            const refs = (0, transclusion_prosemirror_util_1.collectReferencesFromPmJson)(page.content);
            for (const r of refs) {
                rows.push({
                    workspaceId: page.workspaceId,
                    referencePageId: page.id,
                    sourcePageId: r.sourcePageId,
                    transclusionId: r.transclusionId,
                });
            }
        }
        if (rows.length === 0)
            return { inserted: 0 };
        await this.pageTransclusionReferencesRepo.insertMany(rows, trx);
        return { inserted: rows.length };
    }
    async filterViewerAccessiblePageIds(pageIds, viewerUserId, workspaceId) {
        if (pageIds.length === 0)
            return [];
        const spaceVisible = await this.db
            .selectFrom('pages')
            .select('id')
            .where('id', 'in', pageIds)
            .where('workspaceId', '=', workspaceId)
            .where('deletedAt', 'is', null)
            .where('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(viewerUserId))
            .execute();
        if (spaceVisible.length === 0)
            return [];
        return this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds: spaceVisible.map((r) => r.id),
            userId: viewerUserId,
        });
    }
    async lookup(references, viewerUserId, workspaceId) {
        if (references.length === 0)
            return { items: [] };
        const candidatePageIds = Array.from(new Set(references.map((r) => r.sourcePageId)));
        const accessibleSet = new Set(await this.filterViewerAccessiblePageIds(candidatePageIds, viewerUserId, workspaceId));
        return this.lookupWithAccessSet(references, accessibleSet, workspaceId);
    }
    async lookupWithAccessSet(references, accessibleSet, workspaceId) {
        if (references.length === 0)
            return { items: [] };
        const items = new Array(references.length).fill(null);
        const pendingIdx = references.map((_, i) => i);
        const accessiblePending = pendingIdx.filter((i) => accessibleSet.has(references[i].sourcePageId));
        const rows = await this.pageTransclusionsRepo.findManyByPageAndTransclusion(accessiblePending.map((i) => ({
            pageId: references[i].sourcePageId,
            transclusionId: references[i].transclusionId,
        })), workspaceId);
        const rowKey = (r) => `${r.pageId}::${r.transclusionId}`;
        const rowMap = new Map(rows.map((r) => [rowKey(r), r]));
        const accessiblePageIds = Array.from(new Set(accessiblePending.map((i) => references[i].sourcePageId)));
        const pages = await this.pageRepo.findManyByIds(accessiblePageIds, {
            workspaceId,
        });
        const pageMeta = new Map();
        for (const p of pages) {
            pageMeta.set(p.id, p.updatedAt);
        }
        for (const i of pendingIdx) {
            const ref = references[i];
            if (!accessibleSet.has(ref.sourcePageId)) {
                items[i] = {
                    sourcePageId: ref.sourcePageId,
                    transclusionId: ref.transclusionId,
                    status: 'no_access',
                };
                continue;
            }
            const updatedAt = pageMeta.get(ref.sourcePageId);
            if (!updatedAt) {
                items[i] = {
                    sourcePageId: ref.sourcePageId,
                    transclusionId: ref.transclusionId,
                    status: 'not_found',
                };
                continue;
            }
            const row = rowMap.get(`${ref.sourcePageId}::${ref.transclusionId}`);
            if (!row) {
                items[i] = {
                    sourcePageId: ref.sourcePageId,
                    transclusionId: ref.transclusionId,
                    status: 'not_found',
                };
                continue;
            }
            items[i] = {
                sourcePageId: ref.sourcePageId,
                transclusionId: ref.transclusionId,
                content: row.content,
                sourceUpdatedAt: updatedAt,
            };
        }
        return { items };
    }
    async listReferences(opts) {
        const { sourcePageId, transclusionId, viewerUserId, workspaceId } = opts;
        const referencePageIds = await this.pageTransclusionReferencesRepo.findReferencePageIdsByTransclusion(sourcePageId, transclusionId, workspaceId);
        const candidatePageIds = Array.from(new Set([sourcePageId, ...referencePageIds]));
        const accessibleSet = new Set(await this.filterViewerAccessiblePageIds(candidatePageIds, viewerUserId, workspaceId));
        const accessibleIds = candidatePageIds.filter((id) => accessibleSet.has(id));
        if (accessibleIds.length === 0) {
            return { source: null, references: [] };
        }
        const rows = await Promise.all(accessibleIds.map((id) => this.pageRepo.findById(id, { includeSpace: true })));
        const byId = new Map();
        for (const p of rows) {
            if (!p || p.deletedAt || p.workspaceId !== workspaceId)
                continue;
            const space = p.space;
            byId.set(p.id, {
                id: p.id,
                slugId: p.slugId,
                title: p.title ?? null,
                icon: p.icon ?? null,
                spaceId: p.spaceId,
                spaceSlug: space?.slug ?? null,
            });
        }
        const source = byId.get(sourcePageId) ?? null;
        const references = referencePageIds
            .map((id) => byId.get(id))
            .filter((p) => Boolean(p));
        return { source, references };
    }
    async unsyncReference(referencePageId, sourcePageId, transclusionId, user) {
        const referencePage = await this.pageRepo.findById(referencePageId);
        if (!referencePage || referencePage.deletedAt) {
            throw new common_1.NotFoundException('Reference page not found');
        }
        const sourcePage = await this.pageRepo.findById(sourcePageId);
        if (!sourcePage || sourcePage.deletedAt) {
            throw new common_1.NotFoundException('Source page not found');
        }
        if (referencePage.workspaceId !== user.workspaceId ||
            sourcePage.workspaceId !== user.workspaceId) {
            throw new common_1.ForbiddenException();
        }
        await this.pageAccessService.validateCanEdit(referencePage, user);
        await this.pageAccessService.validateCanView(sourcePage, user);
        const transclusion = await this.pageTransclusionsRepo.findByPageAndTransclusion(sourcePageId, transclusionId);
        if (!transclusion) {
            throw new common_1.NotFoundException('Sync block not found');
        }
        const { content, copies } = (0, transclusion_unsync_util_1.rewriteAttachmentsForUnsync)(transclusion.content, () => (0, uuid_1.v7)());
        if (copies.length > 0) {
            const oldIds = copies.map((c) => c.oldAttachmentId);
            const oldRows = await this.attachmentRepo.findByIds(oldIds);
            const byOldId = new Map(oldRows
                .filter((a) => a.pageId === sourcePageId)
                .map((a) => [a.id, a]));
            for (const plan of copies) {
                const old = byOldId.get(plan.oldAttachmentId);
                if (!old)
                    continue;
                const newFilePath = old.filePath
                    .split(plan.oldAttachmentId)
                    .join(plan.newAttachmentId);
                try {
                    await this.storageService.copy(old.filePath, newFilePath);
                }
                catch (err) {
                    this.logger.error(`unsync: failed to copy attachment ${old.id}`, err);
                    continue;
                }
                await this.attachmentRepo.insertAttachment({
                    id: plan.newAttachmentId,
                    type: old.type,
                    filePath: newFilePath,
                    fileName: old.fileName,
                    fileSize: old.fileSize,
                    mimeType: old.mimeType,
                    fileExt: old.fileExt,
                    creatorId: user.id,
                    workspaceId: referencePage.workspaceId,
                    pageId: referencePageId,
                    spaceId: referencePage.spaceId,
                });
            }
        }
        await this.pageTransclusionReferencesRepo.deleteOne(referencePageId, sourcePageId, transclusionId);
        return { content };
    }
};
exports.TransclusionService = TransclusionService;
exports.TransclusionService = TransclusionService = TransclusionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, page_transclusions_repo_1.PageTransclusionsRepo,
        page_transclusion_references_repo_1.PageTransclusionReferencesRepo,
        page_repo_1.PageRepo,
        page_permission_repo_1.PagePermissionRepo,
        space_member_repo_1.SpaceMemberRepo,
        attachment_repo_1.AttachmentRepo,
        storage_service_1.StorageService,
        page_access_service_1.PageAccessService])
], TransclusionService);
//# sourceMappingURL=transclusion.service.js.map