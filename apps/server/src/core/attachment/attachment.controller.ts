import {
    BadRequestException,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    NotFoundException,
    Param,
    Post,
    Req,
    Res,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {AttachmentService} from './services/attachment.service';
import {FastifyReply} from 'fastify';
import {FileInterceptor} from '../../common/interceptors/file.interceptor';
import * as bytes from 'bytes';
import {AuthUser} from '../../common/decorators/auth-user.decorator';
import {AuthWorkspace} from '../../common/decorators/auth-workspace.decorator';
import {JwtAuthGuard} from '../../common/guards/jwt-auth.guard';
import {User, Workspace} from '@docmost/db/types/entity.types';
import {StorageService} from '../../integrations/storage/storage.service';
import {
    getAttachmentFolderPath,
    validAttachmentTypes,
} from './attachment.utils';
import {getMimeType} from '../../common/helpers';
import {
    AttachmentType,
    inlineFileExtensions,
    MAX_AVATAR_SIZE,
} from './attachment.constants';
import {
    SpaceCaslAction,
    SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
    WorkspaceCaslAction,
    WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import {PageRepo} from '@docmost/db/repos/page/page.repo';
import {AttachmentRepo} from '@docmost/db/repos/attachment/attachment.repo';
import {validate as isValidUUID} from 'uuid';
import {EnvironmentService} from "../../integrations/environment/environment.service";

@Controller()
export class AttachmentController {
    private readonly logger = new Logger(AttachmentController.name);

    constructor(
        private readonly attachmentService: AttachmentService,
        private readonly storageService: StorageService,
        private readonly workspaceAbility: WorkspaceAbilityFactory,
        private readonly spaceAbility: SpaceAbilityFactory,
        private readonly pageRepo: PageRepo,
        private readonly attachmentRepo: AttachmentRepo,
        private readonly environmentService: EnvironmentService,
    ) {
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('files/upload')
    @UseInterceptors(FileInterceptor)
    async uploadFile(
        @Req() req: any,
        @Res() res: FastifyReply,
        @AuthUser() user: User,
        @AuthWorkspace() workspace: Workspace,
    ) {
        const maxFileSize = bytes(this.environmentService.getFileUploadSizeLimit());

        let file = null;
        try {
            file = await req.file({
                limits: {fileSize: maxFileSize, fields: 3, files: 1},
            });
        } catch (err: any) {
            this.logger.error(err.message);
            if (err?.statusCode === 413) {
                throw new BadRequestException(
                    `File too large. Exceeds the ${this.environmentService.getFileUploadSizeLimit()} limit`,
                );
            }
        }

        if (!file) {
            throw new BadRequestException('Failed to upload file');
        }

        const pageId = file.fields?.pageId?.value;

        if (!pageId) {
            throw new BadRequestException('PageId is required');
        }

        const page = await this.pageRepo.findById(pageId);

        if (!page) {
            throw new NotFoundException('Page not found');
        }

        const spaceAbility = await this.spaceAbility.createForUser(
            user,
            page.spaceId,
        );
        if (spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
            throw new ForbiddenException();
        }

        const spaceId = page.spaceId;

        const attachmentId = file.fields?.attachmentId?.value;
        if (attachmentId && !isValidUUID(attachmentId)) {
            throw new BadRequestException('Invalid attachment id');
        }

        try {
            const fileResponse = await this.attachmentService.uploadFile({
                filePromise: file,
                pageId: pageId,
                spaceId: spaceId,
                userId: user.id,
                workspaceId: workspace.id,
                attachmentId: attachmentId,
            });

            return res.send(fileResponse);
        } catch (err: any) {
            if (err?.statusCode === 413) {
                const errMessage = `File too large. Exceeds the ${this.environmentService.getFileUploadSizeLimit()} limit`;
                this.logger.error(errMessage);
                throw new BadRequestException(errMessage);
            }
            this.logger.error(err);
            throw new BadRequestException('Error processing file upload.');
        }
    }

    @UseGuards(JwtAuthGuard)
    @Get('/files/:fileId/:fileName')
    async getFile(
        @Res() res: FastifyReply,
        @AuthUser() user: User,
        @AuthWorkspace() workspace: Workspace,
        @Param('fileId') fileId: string,
        @Param('fileName') fileName?: string,
    ) {
        if (!isValidUUID(fileId)) {
            throw new NotFoundException('Invalid file id');
        }

        const attachment = await this.attachmentRepo.findById(fileId);
        if (
            !attachment ||
            attachment.workspaceId !== workspace.id ||
            !attachment.pageId ||
            !attachment.spaceId
        ) {
            throw new NotFoundException();
        }

        const spaceAbility = await this.spaceAbility.createForUser(
            user,
            attachment.spaceId,
        );

        if (spaceAbility.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
            throw new ForbiddenException();
        }

        try {
            const fileStream = await this.storageService.read(attachment.filePath);
            res.headers({
                'Content-Type': attachment.mimeType,
                'Cache-Control': 'private, max-age=3600',
            });

            if (!inlineFileExtensions.includes(attachment.fileExt)) {
                res.header(
                    'Content-Disposition',
                    `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
                );
            }

            return res.send(fileStream);
        } catch (err) {
            this.logger.error(err);
            throw new NotFoundException('File not found');
        }
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('attachments/upload-image')
    @UseInterceptors(FileInterceptor)
    async uploadAvatarOrLogo(
        @Req() req: any,
        @Res() res: FastifyReply,
        @AuthUser() user: User,
        @AuthWorkspace() workspace: Workspace,
    ) {
        const maxFileSize = bytes(MAX_AVATAR_SIZE);

        let file = null;
        try {
            file = await req.file({
                limits: {fileSize: maxFileSize, fields: 3, files: 1},
            });
        } catch (err: any) {
            if (err?.statusCode === 413) {
                throw new BadRequestException(
                    `File too large. Exceeds the ${MAX_AVATAR_SIZE} limit`,
                );
            }
        }

        if (!file) {
            throw new BadRequestException('Invalid file upload');
        }

        const attachmentType = file.fields?.type?.value;
        const spaceId = file.fields?.spaceId?.value;

        if (!attachmentType) {
            throw new BadRequestException('attachment type is required');
        }

        if (
            !validAttachmentTypes.includes(attachmentType) ||
            attachmentType === AttachmentType.File
        ) {
            throw new BadRequestException('Invalid image attachment type');
        }

        if (attachmentType === AttachmentType.WorkspaceLogo) {
            const ability = this.workspaceAbility.createForUser(user, workspace);
            if (
                ability.cannot(
                    WorkspaceCaslAction.Manage,
                    WorkspaceCaslSubject.Settings,
                )
            ) {
                throw new ForbiddenException();
            }
        }

        if (attachmentType === AttachmentType.SpaceLogo) {
            if (!spaceId) {
                throw new BadRequestException('spaceId is required');
            }

            const spaceAbility = await this.spaceAbility.createForUser(user, spaceId);
            if (
                spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)
            ) {
                throw new ForbiddenException();
            }
        }

        try {
            const fileResponse = await this.attachmentService.uploadImage(
                file,
                attachmentType,
                user.id,
                workspace.id,
                spaceId,
            );

            return res.send(fileResponse);
        } catch (err: any) {
            this.logger.error(err);
            throw new BadRequestException('Error processing file upload.');
        }
    }

    @Get('attachments/img/:attachmentType/:fileName')
    async getLogoOrAvatar(
        @Res() res: FastifyReply,
        @AuthWorkspace() workspace: Workspace,
        @Param('attachmentType') attachmentType: AttachmentType,
        @Param('fileName') fileName?: string,
    ) {
        if (
            !validAttachmentTypes.includes(attachmentType) ||
            attachmentType === AttachmentType.File
        ) {
            throw new BadRequestException('Invalid image attachment type');
        }

        const filePath = `${getAttachmentFolderPath(attachmentType, workspace.id)}/${fileName}`;

        try {
            const fileStream = await this.storageService.read(filePath);
            res.headers({
                'Content-Type': getMimeType(filePath),
                'Cache-Control': 'private, max-age=86400',
            });
            return res.send(fileStream);
        } catch (err) {
            this.logger.error(err);
            throw new NotFoundException('File not found');
        }
    }
}
