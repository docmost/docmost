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
var PersistenceExtension_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistenceExtension = void 0;
const Y = require("yjs");
const common_1 = require("@nestjs/common");
const transformer_1 = require("@hocuspocus/transformer");
const collaboration_util_1 = require("../collaboration.util");
const page_repo_1 = require("../../database/repos/page/page.repo");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../database/utils");
const bullmq_1 = require("@nestjs/bullmq");
const constants_1 = require("../../integrations/queue/constants");
const bullmq_2 = require("bullmq");
const utils_2 = require("../../common/helpers/prosemirror/utils");
const node_util_1 = require("node:util");
const collab_history_service_1 = require("../services/collab-history.service");
const constants_2 = require("../constants");
const transclusion_service_1 = require("../../core/page/transclusion/transclusion.service");
let PersistenceExtension = PersistenceExtension_1 = class PersistenceExtension {
    constructor(pageRepo, db, aiQueue, historyQueue, notificationQueue, collabHistory, transclusionService) {
        this.pageRepo = pageRepo;
        this.db = db;
        this.aiQueue = aiQueue;
        this.historyQueue = historyQueue;
        this.notificationQueue = notificationQueue;
        this.collabHistory = collabHistory;
        this.transclusionService = transclusionService;
        this.logger = new common_1.Logger(PersistenceExtension_1.name);
        this.contributors = new Map();
    }
    async onLoadDocument(data) {
        const { documentName, document } = data;
        const pageId = (0, collaboration_util_1.getPageId)(documentName);
        if (!document.isEmpty('default')) {
            return;
        }
        const page = await this.pageRepo.findById(pageId, {
            includeContent: true,
            includeYdoc: true,
        });
        if (!page) {
            this.logger.warn('page not found');
            return;
        }
        if (page.ydoc) {
            this.logger.debug(`ydoc loaded from db: ${pageId}`);
            const doc = new Y.Doc();
            const dbState = new Uint8Array(page.ydoc);
            Y.applyUpdate(doc, dbState);
            return doc;
        }
        if (page.content) {
            this.logger.debug(`converting json to ydoc: ${pageId}`);
            const ydoc = transformer_1.TiptapTransformer.toYdoc(page.content, 'default', collaboration_util_1.tiptapExtensions);
            Y.encodeStateAsUpdate(ydoc);
            return ydoc;
        }
        this.logger.debug(`creating fresh ydoc: ${pageId}`);
        return new Y.Doc();
    }
    async onStoreDocument(data) {
        const { documentName, document, context } = data;
        const pageId = (0, collaboration_util_1.getPageId)(documentName);
        const tiptapJson = transformer_1.TiptapTransformer.fromYdoc(document, 'default');
        const ydocState = Buffer.from(Y.encodeStateAsUpdate(document));
        let textContent = null;
        try {
            textContent = (0, collaboration_util_1.jsonToText)(tiptapJson);
        }
        catch (err) {
            this.logger.warn('jsonToText' + err?.['message']);
        }
        let page = null;
        const editingUserIds = this.consumeContributors(documentName);
        try {
            await (0, utils_1.executeTx)(this.db, async (trx) => {
                page = await this.pageRepo.findById(pageId, {
                    withLock: true,
                    includeContent: true,
                    trx,
                });
                if (!page) {
                    this.logger.error(`Page with id ${pageId} not found`);
                    return;
                }
                if ((0, node_util_1.isDeepStrictEqual)(tiptapJson, page.content)) {
                    page = null;
                    return;
                }
                let contributorIds = undefined;
                try {
                    const existingContributors = page.contributorIds || [];
                    contributorIds = Array.from(new Set([
                        ...existingContributors,
                        ...editingUserIds,
                        page.creatorId,
                    ]));
                }
                catch (err) {
                }
                await this.pageRepo.updatePage({
                    content: tiptapJson,
                    textContent: textContent,
                    ydoc: ydocState,
                    lastUpdatedById: context.user.id,
                    contributorIds: contributorIds,
                }, pageId, trx);
                this.logger.debug(`Page updated: ${pageId} - SlugId: ${page.slugId}`);
            });
        }
        catch (err) {
            this.logger.error(`Failed to update page ${pageId}`, err);
        }
        if (page) {
            document.broadcastStateless(JSON.stringify({
                type: 'page.updated',
                updatedAt: new Date().toISOString(),
                lastUpdatedById: context?.user?.id,
                lastUpdatedBy: context?.user
                    ? {
                        id: context.user?.id,
                        name: context.user?.name,
                        avatarUrl: context.user?.avatarUrl,
                    }
                    : undefined,
            }));
            await this.syncTransclusion(pageId, page.workspaceId, tiptapJson);
        }
        if (page) {
            await this.collabHistory.addContributors(pageId, editingUserIds);
            const mentions = (0, utils_2.extractMentions)(tiptapJson);
            const userMentions = (0, utils_2.extractUserMentions)(mentions);
            const oldMentions = page.content ? (0, utils_2.extractMentions)(page.content) : [];
            const oldMentionedUserIds = (0, utils_2.extractUserMentions)(oldMentions).map((m) => m.entityId);
            if (userMentions.length > 0) {
                await this.notificationQueue.add(constants_1.QueueJob.PAGE_MENTION_NOTIFICATION, {
                    userMentions: userMentions.map((m) => ({
                        userId: m.entityId,
                        mentionId: m.id,
                        creatorId: m.creatorId,
                    })),
                    oldMentionedUserIds,
                    pageId,
                    spaceId: page.spaceId,
                    workspaceId: page.workspaceId,
                });
            }
            await this.aiQueue.add(constants_1.QueueJob.PAGE_CONTENT_UPDATED, {
                pageIds: [pageId],
                workspaceId: page.workspaceId,
            });
            await this.enqueuePageHistory(page);
        }
    }
    async onChange(data) {
        const documentName = data.documentName;
        const userId = data.context?.user?.id;
        if (!userId)
            return;
        if (!this.contributors.has(documentName)) {
            this.contributors.set(documentName, new Set());
        }
        this.contributors.get(documentName).add(userId);
    }
    async afterUnloadDocument(data) {
        const documentName = data.documentName;
        this.contributors.delete(documentName);
    }
    consumeContributors(documentName) {
        const contributorSet = this.contributors.get(documentName);
        if (!contributorSet)
            return [];
        const userIds = [...contributorSet];
        this.contributors.delete(documentName);
        return userIds;
    }
    async enqueuePageHistory(page) {
        const pageAge = Date.now() - new Date(page.createdAt).getTime();
        const delay = pageAge < constants_2.HISTORY_FAST_THRESHOLD
            ? constants_2.HISTORY_FAST_INTERVAL
            : constants_2.HISTORY_INTERVAL;
        await this.historyQueue.add(constants_1.QueueJob.PAGE_HISTORY, { pageId: page.id }, { jobId: page.id, delay });
    }
    async syncTransclusion(pageId, workspaceId, tiptapJson) {
        try {
            await this.transclusionService.syncPageTransclusions(pageId, workspaceId, tiptapJson);
        }
        catch (err) {
            this.logger.error({ err, pageId }, 'Failed to sync transclusions for page');
        }
        try {
            await this.transclusionService.syncPageReferences(pageId, workspaceId, tiptapJson);
        }
        catch (err) {
            this.logger.error({ err, pageId }, 'Failed to sync transclusion references for page');
        }
    }
};
exports.PersistenceExtension = PersistenceExtension;
exports.PersistenceExtension = PersistenceExtension = PersistenceExtension_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, nestjs_kysely_1.InjectKysely)()),
    __param(2, (0, bullmq_1.InjectQueue)(constants_1.QueueName.AI_QUEUE)),
    __param(3, (0, bullmq_1.InjectQueue)(constants_1.QueueName.HISTORY_QUEUE)),
    __param(4, (0, bullmq_1.InjectQueue)(constants_1.QueueName.NOTIFICATION_QUEUE)),
    __metadata("design:paramtypes", [page_repo_1.PageRepo, Object, bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        collab_history_service_1.CollabHistoryService,
        transclusion_service_1.TransclusionService])
], PersistenceExtension);
//# sourceMappingURL=persistence.extension.js.map