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
var AttachmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentService = void 0;
const common_1 = require("@nestjs/common");
const storage_service_1 = require("../../../integrations/storage/storage.service");
const attachment_utils_1 = require("../attachment.utils");
const uuid_1 = require("uuid");
const attachment_repo_1 = require("../../../database/repos/attachment/attachment.repo");
const attachment_constants_1 = require("../attachment.constants");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../../database/utils");
const user_repo_1 = require("../../../database/repos/user/user.repo");
const workspace_repo_1 = require("../../../database/repos/workspace/workspace.repo");
const space_repo_1 = require("../../../database/repos/space/space.repo");
const bullmq_1 = require("@nestjs/bullmq");
const constants_1 = require("../../../integrations/queue/constants");
const bullmq_2 = require("bullmq");
const utils_2 = require("../../../common/helpers/utils");
let AttachmentService = AttachmentService_1 = class AttachmentService {
    constructor(storageService, attachmentRepo, userRepo, workspaceRepo, spaceRepo, db, attachmentQueue) {
        this.storageService = storageService;
        this.attachmentRepo = attachmentRepo;
        this.userRepo = userRepo;
        this.workspaceRepo = workspaceRepo;
        this.spaceRepo = spaceRepo;
        this.db = db;
        this.attachmentQueue = attachmentQueue;
        this.logger = new common_1.Logger(AttachmentService_1.name);
    }
    async uploadFile(opts) {
        const { filePromise, pageId, spaceId, userId, workspaceId } = opts;
        const preparedFile = await (0, attachment_utils_1.prepareFile)(filePromise, {
            skipBuffer: true,
        });
        let isUpdate = false;
        let attachmentId = null;
        if (opts?.attachmentId) {
            const existingAttachment = await this.attachmentRepo.findById(opts.attachmentId);
            if (!existingAttachment) {
                throw new common_1.NotFoundException('Existing attachment to overwrite not found');
            }
            if (existingAttachment.pageId !== pageId ||
                existingAttachment.fileExt !== preparedFile.fileExtension ||
                existingAttachment.workspaceId !== workspaceId) {
                throw new common_1.BadRequestException('File attachment does not match');
            }
            attachmentId = opts.attachmentId;
            isUpdate = true;
        }
        else {
            attachmentId = (0, uuid_1.v7)();
        }
        const filePath = `${(0, attachment_utils_1.getAttachmentFolderPath)(attachment_constants_1.AttachmentType.File, workspaceId)}/${attachmentId}/${preparedFile.fileName}`;
        const { stream, getBytesRead } = (0, utils_2.createByteCountingStream)(preparedFile.multiPartFile.file);
        await this.uploadToDrive(filePath, stream);
        preparedFile.fileSize = getBytesRead();
        let attachment = null;
        try {
            if (isUpdate) {
                attachment = await this.attachmentRepo.updateAttachment({
                    fileSize: preparedFile.fileSize,
                    updatedAt: new Date(),
                }, attachmentId);
            }
            else {
                attachment = await this.saveAttachment({
                    attachmentId,
                    preparedFile,
                    filePath,
                    type: attachment_constants_1.AttachmentType.File,
                    userId,
                    spaceId,
                    workspaceId,
                    pageId,
                });
            }
            if (['.pdf', '.docx'].includes(attachment.fileExt.toLowerCase())) {
                await this.attachmentQueue.add(constants_1.QueueJob.ATTACHMENT_INDEX_CONTENT, {
                    attachmentId: attachmentId,
                }, {
                    attempts: 2,
                    backoff: {
                        type: 'exponential',
                        delay: 10000,
                    },
                });
            }
        }
        catch (err) {
            this.logger.error(err);
        }
        return attachment;
    }
    async uploadImage(filePromise, type, userId, workspaceId, spaceId) {
        const preparedFile = await (0, attachment_utils_1.prepareFile)(filePromise);
        (0, attachment_utils_1.validateFileType)(preparedFile.fileExtension, attachment_constants_1.validImageExtensions);
        preparedFile.fileName = (0, uuid_1.v4)() + preparedFile.fileExtension;
        const filePath = `${(0, attachment_utils_1.getAttachmentFolderPath)(type, workspaceId)}/${preparedFile.fileName}`;
        await this.uploadToDrive(filePath, preparedFile.buffer);
        let attachment = null;
        let oldFileName = null;
        try {
            await (0, utils_1.executeTx)(this.db, async (trx) => {
                attachment = await this.saveAttachment({
                    preparedFile,
                    filePath,
                    type,
                    userId,
                    workspaceId,
                    trx,
                });
                if (type === attachment_constants_1.AttachmentType.Avatar) {
                    const user = await this.userRepo.findById(userId, workspaceId, {
                        trx,
                    });
                    oldFileName = user.avatarUrl;
                    await this.userRepo.updateUser({ avatarUrl: preparedFile.fileName }, userId, workspaceId, trx);
                }
                else if (type === attachment_constants_1.AttachmentType.WorkspaceIcon) {
                    const workspace = await this.workspaceRepo.findById(workspaceId, {
                        trx,
                    });
                    oldFileName = workspace.logo;
                    await this.workspaceRepo.updateWorkspace({ logo: preparedFile.fileName }, workspaceId, trx);
                }
                else if (type === attachment_constants_1.AttachmentType.SpaceIcon && spaceId) {
                    const space = await this.spaceRepo.findById(spaceId, workspaceId, {
                        trx,
                    });
                    oldFileName = space.logo;
                    await this.spaceRepo.updateSpace({ logo: preparedFile.fileName }, spaceId, workspaceId, trx);
                }
                else {
                    throw new common_1.BadRequestException(`Image upload aborted.`);
                }
            });
        }
        catch (err) {
            await this.deleteRedundantFile(filePath);
            throw new common_1.BadRequestException('Failed to upload image');
        }
        if (oldFileName && !oldFileName.toLowerCase().startsWith('http')) {
            const oldFilePath = (0, attachment_utils_1.getAttachmentFolderPath)(type, workspaceId) + '/' + oldFileName;
            await this.deleteRedundantFile(oldFilePath);
        }
        return attachment;
    }
    async deleteRedundantFile(filePath) {
        try {
            await this.storageService.delete(filePath);
            await this.attachmentRepo.deleteAttachmentByFilePath(filePath);
        }
        catch (error) {
            this.logger.error('deleteRedundantFile', error);
        }
    }
    async uploadToDrive(filePath, fileContent) {
        try {
            await this.storageService.upload(filePath, fileContent);
        }
        catch (err) {
            this.logger.error('Error uploading file to drive:', err);
            throw new common_1.BadRequestException('Error uploading file to drive');
        }
    }
    async saveAttachment(opts) {
        const { attachmentId, preparedFile, filePath, type, userId, workspaceId, pageId, spaceId, trx, } = opts;
        return this.attachmentRepo.insertAttachment({
            id: attachmentId,
            type: type,
            filePath: filePath,
            fileName: preparedFile.fileName,
            fileSize: preparedFile.fileSize,
            mimeType: preparedFile.mimeType,
            fileExt: preparedFile.fileExtension,
            creatorId: userId,
            workspaceId: workspaceId,
            pageId: pageId,
            spaceId: spaceId,
        }, trx);
    }
    async handleDeleteAiChatAttachments(aiChatId) {
        try {
            const attachments = await this.attachmentRepo.findByAiChatId(aiChatId);
            if (!attachments || attachments.length === 0) {
                return;
            }
            await Promise.all(attachments.map(async (attachment) => {
                try {
                    await this.storageService.delete(attachment.filePath);
                    await this.attachmentRepo.deleteAttachmentById(attachment.id);
                }
                catch (err) {
                    this.logger.log(`DeleteAiChatAttachments: failed to delete attachment ${attachment.id}:`, err);
                }
            }));
        }
        catch (err) {
            throw err;
        }
    }
    async handleDeleteSpaceAttachments(spaceId) {
        try {
            const attachments = await this.attachmentRepo.findBySpaceId(spaceId);
            if (!attachments || attachments.length === 0) {
                return;
            }
            const failedDeletions = [];
            await Promise.all(attachments.map(async (attachment) => {
                try {
                    await this.storageService.delete(attachment.filePath);
                    await this.attachmentRepo.deleteAttachmentById(attachment.id);
                }
                catch (err) {
                    failedDeletions.push(attachment.id);
                    this.logger.log(`DeleteSpaceAttachments: failed to delete attachment ${attachment.id}:`, err);
                }
            }));
            if (failedDeletions.length === attachments.length) {
                throw new Error(`Failed to delete any attachments for spaceId: ${spaceId}`);
            }
        }
        catch (err) {
            throw err;
        }
    }
    async handleDeleteUserAvatars(userId) {
        try {
            const userAvatars = await this.db
                .selectFrom('attachments')
                .select(['id', 'filePath'])
                .where('creatorId', '=', userId)
                .where('type', '=', attachment_constants_1.AttachmentType.Avatar)
                .execute();
            if (!userAvatars || userAvatars.length === 0) {
                return;
            }
            await Promise.all(userAvatars.map(async (attachment) => {
                try {
                    await this.storageService.delete(attachment.filePath);
                    await this.attachmentRepo.deleteAttachmentById(attachment.id);
                }
                catch (err) {
                    this.logger.log(`DeleteUserAvatar: failed to delete user avatar ${attachment.id}:`, err);
                }
            }));
        }
        catch (err) {
            throw err;
        }
    }
    async handleDeletePageAttachments(pageId) {
        try {
            const attachments = await this.db
                .selectFrom('attachments')
                .select(['id', 'filePath'])
                .where('pageId', '=', pageId)
                .execute();
            if (!attachments || attachments.length === 0) {
                return;
            }
            const failedDeletions = [];
            await Promise.all(attachments.map(async (attachment) => {
                try {
                    await this.storageService.delete(attachment.filePath);
                    await this.attachmentRepo.deleteAttachmentById(attachment.id);
                }
                catch (err) {
                    failedDeletions.push(attachment.id);
                    this.logger.error(`Failed to delete attachment ${attachment.id} for page ${pageId}:`, err);
                }
            }));
            if (failedDeletions.length > 0) {
                this.logger.warn(`Failed to delete ${failedDeletions.length} attachments for page ${pageId}`);
            }
        }
        catch (err) {
            this.logger.error(`Error in handleDeletePageAttachments for page ${pageId}:`, err);
            throw err;
        }
    }
    async removeUserAvatar(user) {
        if (user.avatarUrl && !user.avatarUrl.toLowerCase().startsWith('http')) {
            const filePath = `${(0, attachment_utils_1.getAttachmentFolderPath)(attachment_constants_1.AttachmentType.Avatar, user.workspaceId)}/${user.avatarUrl}`;
            await this.deleteRedundantFile(filePath);
        }
        await this.userRepo.updateUser({ avatarUrl: null }, user.id, user.workspaceId);
    }
    async removeSpaceIcon(spaceId, workspaceId) {
        const space = await this.spaceRepo.findById(spaceId, workspaceId);
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        if (space.logo && !space.logo.toLowerCase().startsWith('http')) {
            const filePath = `${(0, attachment_utils_1.getAttachmentFolderPath)(attachment_constants_1.AttachmentType.SpaceIcon, workspaceId)}/${space.logo}`;
            await this.deleteRedundantFile(filePath);
        }
        await this.spaceRepo.updateSpace({ logo: null }, spaceId, workspaceId);
    }
    async removeWorkspaceIcon(workspace) {
        if (workspace.logo && !workspace.logo.toLowerCase().startsWith('http')) {
            const filePath = `${(0, attachment_utils_1.getAttachmentFolderPath)(attachment_constants_1.AttachmentType.WorkspaceIcon, workspace.id)}/${workspace.logo}`;
            await this.deleteRedundantFile(filePath);
        }
        await this.workspaceRepo.updateWorkspace({ logo: null }, workspace.id);
    }
};
exports.AttachmentService = AttachmentService;
exports.AttachmentService = AttachmentService = AttachmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, nestjs_kysely_1.InjectKysely)()),
    __param(6, (0, bullmq_1.InjectQueue)(constants_1.QueueName.ATTACHMENT_QUEUE)),
    __metadata("design:paramtypes", [storage_service_1.StorageService,
        attachment_repo_1.AttachmentRepo,
        user_repo_1.UserRepo,
        workspace_repo_1.WorkspaceRepo,
        space_repo_1.SpaceRepo, Object, bullmq_2.Queue])
], AttachmentService);
//# sourceMappingURL=attachment.service.js.map