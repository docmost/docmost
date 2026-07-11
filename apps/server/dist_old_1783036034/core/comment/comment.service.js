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
var CommentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const create_comment_dto_1 = require("./dto/create-comment.dto");
const collaboration_gateway_1 = require("../../collaboration/collaboration.gateway");
const comment_repo_1 = require("../../database/repos/comment/comment.repo");
const page_repo_1 = require("../../database/repos/page/page.repo");
const constants_1 = require("../../integrations/queue/constants");
const utils_1 = require("../../common/helpers/prosemirror/utils");
const ws_service_1 = require("../../ws/ws.service");
let CommentService = CommentService_1 = class CommentService {
    constructor(commentRepo, pageRepo, wsService, collaborationGateway, generalQueue, notificationQueue) {
        this.commentRepo = commentRepo;
        this.pageRepo = pageRepo;
        this.wsService = wsService;
        this.collaborationGateway = collaborationGateway;
        this.generalQueue = generalQueue;
        this.notificationQueue = notificationQueue;
        this.logger = new common_1.Logger(CommentService_1.name);
    }
    async findById(commentId) {
        const comment = await this.commentRepo.findById(commentId, {
            includeCreator: true,
            includeResolvedBy: true,
        });
        if (!comment) {
            throw new common_1.NotFoundException('Comment not found');
        }
        return comment;
    }
    async create(opts, createCommentDto) {
        const { page, workspaceId, user } = opts;
        const commentContent = JSON.parse(createCommentDto.content);
        if (createCommentDto.parentCommentId) {
            const parentComment = await this.commentRepo.findById(createCommentDto.parentCommentId);
            if (!parentComment || parentComment.pageId !== page.id) {
                throw new common_1.BadRequestException('Parent comment not found');
            }
            if (parentComment.parentCommentId !== null) {
                throw new common_1.BadRequestException('You cannot reply to a reply');
            }
        }
        const inserted = await this.commentRepo.insertComment({
            pageId: page.id,
            content: commentContent,
            selection: createCommentDto?.selection?.substring(0, 250) ?? null,
            type: createCommentDto.type ?? 'page',
            parentCommentId: createCommentDto?.parentCommentId,
            creatorId: user.id,
            workspaceId: workspaceId,
            spaceId: page.spaceId,
        });
        if (createCommentDto.yjsSelection) {
            const parsed = create_comment_dto_1.yjsSelectionSchema.safeParse(createCommentDto.yjsSelection);
            if (!parsed.success) {
                this.logger.warn(`Invalid yjsSelection for comment ${inserted.id}: ${parsed.error.message}`);
            }
            else {
                const documentName = `page.${page.id}`;
                try {
                    await this.collaborationGateway.handleYjsEvent('setCommentMark', documentName, {
                        yjsSelection: parsed.data,
                        commentId: inserted.id,
                        resolved: false,
                        user,
                    });
                }
                catch (error) {
                    this.logger.warn(`Failed to apply comment mark for comment ${inserted.id}, comment saved without inline highlight`, error);
                }
            }
        }
        const comment = await this.commentRepo.findById(inserted.id, {
            includeCreator: true,
            includeResolvedBy: true,
        });
        this.generalQueue
            .add(constants_1.QueueJob.ADD_PAGE_WATCHERS, {
            userIds: [user.id],
            pageId: page.id,
            spaceId: page.spaceId,
            workspaceId,
        })
            .catch((err) => this.logger.warn(`Failed to queue add-page-watchers: ${err.message}`));
        const isReply = !!createCommentDto.parentCommentId;
        await this.queueCommentNotification(commentContent, [], comment.id, page.id, page.spaceId, workspaceId, user.id, !isReply, createCommentDto.parentCommentId);
        this.wsService.emitCommentEvent(page.spaceId, page.id, {
            operation: 'commentCreated',
            pageId: page.id,
            comment,
        });
        return comment;
    }
    async findByPageId(pageId, pagination) {
        const page = await this.pageRepo.findById(pageId);
        if (!page) {
            throw new common_1.BadRequestException('Page not found');
        }
        return this.commentRepo.findPageComments(pageId, pagination);
    }
    async update(comment, updateCommentDto, authUser) {
        const commentContent = JSON.parse(updateCommentDto.content);
        if (comment.creatorId !== authUser.id) {
            throw new common_1.ForbiddenException('You can only edit your own comments');
        }
        const oldMentionIds = (0, utils_1.extractUserMentionIdsFromJson)(comment.content);
        const editedAt = new Date();
        await this.commentRepo.updateComment({
            content: commentContent,
            editedAt: editedAt,
            updatedAt: editedAt,
        }, comment.id);
        await this.queueCommentNotification(commentContent, oldMentionIds, comment.id, comment.pageId, comment.spaceId, comment.workspaceId, authUser.id, false);
        comment.content = commentContent;
        comment.editedAt = editedAt;
        comment.updatedAt = editedAt;
        this.wsService.emitCommentEvent(comment.spaceId, comment.pageId, {
            operation: 'commentUpdated',
            pageId: comment.pageId,
            comment,
        });
        return comment;
    }
    async queueCommentNotification(content, oldMentionIds, commentId, pageId, spaceId, workspaceId, actorId, notifyWatchers, parentCommentId) {
        const mentionedUserIds = (0, utils_1.extractUserMentionIdsFromJson)(content);
        const newMentionIds = mentionedUserIds.filter((id) => id !== actorId && !oldMentionIds.includes(id));
        if (newMentionIds.length === 0 && !notifyWatchers && !parentCommentId)
            return;
        const jobData = {
            commentId,
            parentCommentId,
            pageId,
            spaceId,
            workspaceId,
            actorId,
            mentionedUserIds: newMentionIds,
            notifyWatchers,
        };
        await this.notificationQueue.add(constants_1.QueueJob.COMMENT_NOTIFICATION, jobData);
    }
};
exports.CommentService = CommentService;
exports.CommentService = CommentService = CommentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, bullmq_1.InjectQueue)(constants_1.QueueName.GENERAL_QUEUE)),
    __param(5, (0, bullmq_1.InjectQueue)(constants_1.QueueName.NOTIFICATION_QUEUE)),
    __metadata("design:paramtypes", [comment_repo_1.CommentRepo,
        page_repo_1.PageRepo,
        ws_service_1.WsService,
        collaboration_gateway_1.CollaborationGateway,
        bullmq_2.Queue,
        bullmq_2.Queue])
], CommentService);
//# sourceMappingURL=comment.service.js.map