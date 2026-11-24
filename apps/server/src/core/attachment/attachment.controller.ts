import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DiagramDraftService } from './services/diagram-draft.service';
import { AttachmentService } from './services/attachment.service';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ModuleRef } from '@nestjs/core';
import { FileInterceptor } from '../../common/interceptors/file.interceptor';
import * as bytes from 'bytes';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OAuthScope } from '../../common/decorators/oauth-scope.decorator';
import {
  Attachment,
  Page,
  Template,
  User,
  Workspace,
} from '@docmost/db/types/entity.types';
import { StorageService } from '../../integrations/storage/storage.service';
import {
  diagramFileName,
  getAttachmentFolderPath,
  validAttachmentTypes,
} from './attachment.utils';
import { getMimeType } from '../../common/helpers';
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
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { TemplateRepo } from '@docmost/db/repos/template/template.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { validate as isValidUUID } from 'uuid';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { TokenService } from '../auth/services/token.service';
import { JwtAttachmentPayload, JwtType } from '../auth/dto/jwt-payload';
import * as path from 'path';
import {
  AttachmentInfoDto,
  DeleteAttachmentDto,
  PageIdDto,
  RemoveIconDto,
  RenameDiagramDto,
  DiagramDraftDto,
  DiagramHistoryDto,
} from './dto/attachment.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { PageAccessService } from '../page/page-access/page-access.service';
import { DomainService } from '../../integrations/environment/domain.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { ApiKeyScope } from '../../common/decorators/api-key-scope.decorator';

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
    private readonly tokenService: TokenService,
    private readonly pageAccessService: PageAccessService,
    private readonly domainService: DomainService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
    private readonly templateRepo: TemplateRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly moduleRef: ModuleRef,
    private readonly diagramDrafts: DiagramDraftService,
  ) {}

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
        limits: { fileSize: maxFileSize, fields: 3, files: 1 },
      });
    } catch (err: any) {
      this.logger.error(err.message);
      if (err?.statusCode === 413) {
        throw new PayloadTooLargeException(
          `File too large. Exceeds the ${this.environmentService.getFileUploadSizeLimit()} limit`,
        );
      }
    }

    if (!file) {
      throw new BadRequestException('Failed to upload file');
    }

    const pageId = file.fields?.pageId?.value || undefined;
    const templateId = file.fields?.templateId?.value || undefined;

    if (file.fields?.attachmentId) {
      throw new BadRequestException(
        'Existing attachments cannot be overwritten',
      );
    }
    const { page, spaceId } = await this.editableTarget(
      pageId,
      templateId,
      user,
      workspace,
    );
    const previousAttachmentId = file.fields?.previousAttachmentId?.value;
    const draftId = file.fields?.draftId?.value;
    if (
      (previousAttachmentId && !isValidUUID(previousAttachmentId)) ||
      (draftId && !isValidUUID(draftId)) ||
      (draftId && previousAttachmentId)
    ) {
      throw new BadRequestException('Invalid diagram id');
    }

    const type: unknown = file.fields?.type?.value ?? AttachmentType.File;
    const isCover = type === AttachmentType.PageCover;
    const diagramType =
      type === 'drawio' || type === 'excalidraw' ? type : undefined;
    if (
      (type !== AttachmentType.File && !isCover && !diagramType) ||
      ((previousAttachmentId || draftId) && !diagramType) ||
      (isCover && templateId)
    ) {
      throw new BadRequestException('Invalid attachment type');
    }

    try {
      if (draftId) {
        const key = this.draftKey(
          workspace,
          user,
          page?.id,
          templateId,
          diagramType,
          draftId,
        );
        await this.diagramDrafts.write(key, file);
        return res.status(HttpStatus.NO_CONTENT).send();
      }
      const fileResponse = await this.attachmentService.uploadFile({
        filePromise: file,
        pageId: page?.id,
        templateId: templateId,
        spaceId: spaceId,
        userId: user.id,
        workspaceId: workspace.id,
        previousAttachmentId,
        type: isCover ? AttachmentType.PageCover : AttachmentType.File,
        diagramType,
      });

      this.auditService.log({
        event: AuditEvent.ATTACHMENT_UPLOADED,
        resourceType: AuditResource.ATTACHMENT,
        resourceId: fileResponse.id,
        spaceId: spaceId ?? undefined,
        metadata: {
          fileName: fileResponse?.fileName,
          pageId: page?.id,
          templateId,
          spaceId,
        },
      });

      return res.send({
        ...fileResponse,
        url: this.buildFileUrl(workspace, fileResponse),
      });
    } catch (err: any) {
      if ((isCover || diagramType) && err instanceof HttpException) {
        throw err;
      }
      if (err?.statusCode === 413) {
        const errMessage = `File too large. Exceeds the ${this.environmentService.getFileUploadSizeLimit()} limit`;
        this.logger.error(errMessage);
        throw new PayloadTooLargeException(errMessage);
      }
      this.logger.error(err);
      throw new BadRequestException('Error processing file upload.');
    }
  }

  @Post('attachments/diagram-draft')
  @UseGuards(JwtAuthGuard)
  @OAuthScope('write')
  async readDiagramDraft(
    @Body() dto: DiagramDraftDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    const key = await this.resolveDraft(dto, user, workspace);
    const stream = await this.diagramDrafts.read(key);
    res.header('Cache-Control', 'private, no-store');
    if (!stream) return res.status(HttpStatus.NO_CONTENT).send();
    return res
      .status(HttpStatus.OK)
      .type('application/octet-stream')
      .header('X-Content-Type-Options', 'nosniff')
      .send(stream);
  }

  @Post('attachments/discard-diagram-draft')
  @UseGuards(JwtAuthGuard)
  @OAuthScope('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  async discardDiagramDraft(
    @Body() dto: DiagramDraftDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const key = await this.resolveDraft(dto, user, workspace);
    await this.diagramDrafts.discard(key);
  }

  @Post('attachments/diagram-history')
  @UseGuards(JwtAuthGuard)
  @OAuthScope('read')
  @HttpCode(HttpStatus.OK)
  async diagramHistory(
    @Body() dto: DiagramHistoryDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const attachment = await this.getAttachmentInfo(dto, workspace, user);
    if (!attachment.diagramType)
      throw new NotFoundException('Diagram not found');
    return this.attachmentRepo.findDiagramHistory(attachment, dto.before);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/files/:fileId/:fileName')
  @OAuthScope('read')
  async getFile(
    @Req() req: FastifyRequest,
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
    if (!attachment || attachment.workspaceId !== workspace.id) {
      throw new NotFoundException();
    }

    if (attachment.aiChatId) {
      // Chat-owned attachment: only the user who uploaded (and therefore
      // owns the chat, per AttachmentRepo.claimAttachmentsForChat) can
      // read it back.
      if (attachment.creatorId !== user.id) {
        throw new NotFoundException();
      }
    } else if (attachment.templateId) {
      if (!(await this.canViewTemplateFile(attachment, user, workspace))) {
        throw new NotFoundException();
      }
    } else {
      if (!attachment.pageId || !attachment.spaceId) {
        throw new NotFoundException();
      }

      const page = await this.pageRepo.findById(attachment.pageId);
      if (!page) {
        throw new NotFoundException();
      }

      await this.pageAccessService.validateCanView(page, user);
    }

    try {
      return await this.sendFileResponse(req, res, attachment, 'private');
    } catch (err) {
      this.logger.error(err);
      throw new NotFoundException('File not found');
    }
  }

  @Get('/files/public/:fileId/:fileName')
  async getPublicFile(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @AuthWorkspace() workspace: Workspace,
    @Param('fileId') fileId: string,
    @Param('fileName') fileName?: string,
    @Query('jwt') jwtToken?: string,
  ) {
    let jwtPayload: JwtAttachmentPayload = null;
    try {
      jwtPayload = await this.tokenService.verifyJwt(
        jwtToken,
        JwtType.ATTACHMENT,
      );
    } catch (err) {
      throw new BadRequestException(
        'Expired or invalid attachment access token',
      );
    }

    if (
      !isValidUUID(fileId) ||
      fileId !== jwtPayload.attachmentId ||
      jwtPayload.workspaceId !== workspace.id
    ) {
      throw new NotFoundException('File not found');
    }

    const attachment = await this.attachmentRepo.findById(fileId);
    if (
      !attachment ||
      attachment.workspaceId !== workspace.id ||
      !attachment.pageId ||
      !attachment.spaceId ||
      jwtPayload.pageId !== attachment.pageId
    ) {
      throw new NotFoundException('File not found');
    }

    try {
      return await this.sendFileResponse(req, res, attachment, 'public');
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
        limits: { fileSize: maxFileSize, fields: 3, files: 1 },
      });
    } catch (err: any) {
      if (err?.statusCode === 413) {
        throw new PayloadTooLargeException(
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
      attachmentType === AttachmentType.File ||
      attachmentType === AttachmentType.PageCover
    ) {
      throw new BadRequestException('Invalid image attachment type');
    }

    if (attachmentType === AttachmentType.WorkspaceIcon) {
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

    if (attachmentType === AttachmentType.SpaceIcon) {
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
      if (err?.statusCode === 413) {
        throw new PayloadTooLargeException(
          `File too large. Exceeds the ${MAX_AVATAR_SIZE} limit`,
        );
      }
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
      attachmentType === AttachmentType.File ||
      attachmentType === AttachmentType.PageCover
    ) {
      throw new BadRequestException('Invalid image attachment type');
    }

    if (!fileName) {
      throw new BadRequestException('Invalid file name');
    }

    const ext = path.extname(fileName);
    const filenameWithoutExt = path.basename(fileName, ext);

    if (
      !ext ||
      !isValidUUID(filenameWithoutExt) ||
      `${filenameWithoutExt}${ext}` !== fileName
    ) {
      throw new BadRequestException('Invalid file name');
    }

    const filePath = `${getAttachmentFolderPath(attachmentType, workspace.id)}/${fileName}`;

    try {
      const fileStream = await this.storageService.readStream(filePath);
      res.headers({
        'Content-Type': getMimeType(filePath),
        'Cache-Control': 'private, max-age=86400',
      });
      return res.send(fileStream);
    } catch (err) {
      // this.logger.error(err);
      throw new NotFoundException('File not found');
    }
  }

  @ApiKeyScope('read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('files/info')
  async getAttachmentInfo(
    @Body() dto: AttachmentInfoDto,
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
  ) {
    const attachment = await this.attachmentRepo.findById(dto.attachmentId);
    if (
      !attachment ||
      (!attachment.pageId && !attachment.templateId) ||
      attachment.workspaceId !== workspace.id ||
      attachment.type !== AttachmentType.File
    ) {
      throw new NotFoundException('File not found');
    }

    if (attachment.templateId) {
      if (!(await this.canViewTemplateFile(attachment, user, workspace))) {
        throw new NotFoundException('File not found');
      }
      return { ...attachment, url: this.buildFileUrl(workspace, attachment) };
    }

    const page = await this.pageRepo.findById(attachment.pageId);
    if (!page) {
      throw new NotFoundException('File not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    return { ...attachment, url: this.buildFileUrl(workspace, attachment) };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('attachments/rename-diagram')
  @OAuthScope('write')
  async renameDiagram(
    @Body() dto: RenameDiagramDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const attachment = await this.attachmentRepo.findById(dto.attachmentId);
    if (
      !attachment ||
      attachment.workspaceId !== workspace.id ||
      attachment.type !== AttachmentType.File ||
      (attachment.diagramType !== 'drawio' &&
        attachment.diagramType !== 'excalidraw') ||
      (!attachment.pageId && !attachment.templateId)
    ) {
      throw new NotFoundException('Diagram not found');
    }

    if (attachment.templateId) {
      await this.findEditableTemplate(attachment.templateId, user, workspace);
    } else {
      const page = await this.pageRepo.findById(attachment.pageId);
      if (!page) throw new NotFoundException('Page not found');
      await this.pageAccessService.validateCanEdit(page, user);
    }

    const fileName = diagramFileName(dto.name, attachment.diagramType);
    if (!fileName) throw new BadRequestException('Invalid diagram name');

    const updated = await this.attachmentRepo.updateAttachment(
      { fileName, updatedAt: new Date() },
      attachment.id,
    );
    if (!updated) throw new NotFoundException('Diagram not found');
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('pages/attachments')
  @OAuthScope('read')
  async getPageAttachments(
    @Body() dto: PageIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page || page.workspaceId !== workspace.id) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    const result = await this.attachmentRepo.findPageAttachments(
      page.id,
      pagination,
    );

    return {
      ...result,
      items: result.items.map((attachment) => ({
        ...attachment,
        url: this.buildFileUrl(workspace, attachment),
      })),
    };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('attachments/delete')
  async deleteAttachment(
    @Body() dto: DeleteAttachmentDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const attachment = await this.attachmentRepo.findById(dto.attachmentId);
    if (
      !attachment ||
      !attachment.pageId ||
      attachment.workspaceId !== workspace.id ||
      attachment.type !== AttachmentType.File
    ) {
      throw new NotFoundException('File not found');
    }

    const page = await this.pageRepo.findById(attachment.pageId);
    if (!page) {
      throw new NotFoundException('File not found');
    }

    await this.pageAccessService.validateCanEdit(page, user);

    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      page.spaceId,
    );
    if (
      spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException('Only space admins can delete files');
    }

    await this.attachmentService.deleteAttachment(attachment);

    this.auditService.log({
      event: AuditEvent.ATTACHMENT_DELETED,
      resourceType: AuditResource.ATTACHMENT,
      resourceId: attachment.id,
      spaceId: page.spaceId,
      changes: {
        before: {
          fileName: attachment.fileName,
          pageId: page.id,
          creatorId: attachment.creatorId,
        },
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('attachments/remove-icon')
  async removeIcon(
    @Body() dto: RemoveIconDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { type, spaceId } = dto;

    // remove current user avatar
    if (type === AttachmentType.Avatar) {
      await this.attachmentService.removeUserAvatar(user);
      return;
    }

    // remove space icon
    if (type === AttachmentType.SpaceIcon) {
      if (!spaceId) {
        throw new BadRequestException(
          'spaceId is required to change space icons',
        );
      }

      const spaceAbility = await this.spaceAbility.createForUser(user, spaceId);
      if (
        spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)
      ) {
        throw new ForbiddenException();
      }

      await this.attachmentService.removeSpaceIcon(spaceId, workspace.id);
      return;
    }

    // remove workspace icon
    if (type === AttachmentType.WorkspaceIcon) {
      const ability = this.workspaceAbility.createForUser(user, workspace);
      if (
        ability.cannot(
          WorkspaceCaslAction.Manage,
          WorkspaceCaslSubject.Settings,
        )
      ) {
        throw new ForbiddenException();
      }
      await this.attachmentService.removeWorkspaceIcon(workspace);
      return;
    }
  }

  private buildFileUrl(workspace: Workspace, attachment: Attachment): string {
    return `${this.domainService.getUrl(workspace.hostname)}/api/files/${attachment.id}/${encodeURIComponent(attachment.fileName)}`;
  }

  private async editableTarget(
    pageId: string | undefined,
    templateId: string | undefined,
    user: User,
    workspace: Workspace,
  ) {
    if (!pageId && !templateId) {
      throw new BadRequestException('PageId is required');
    }

    if (pageId && templateId) {
      throw new BadRequestException('Use either pageId or templateId');
    }

    if (templateId && !isValidUUID(templateId)) {
      throw new BadRequestException('Invalid template id');
    }

    let page: Page;
    let spaceId: string | null;
    if (templateId) {
      const template = await this.findEditableTemplate(
        templateId,
        user,
        workspace,
      );
      spaceId = template.spaceId;
    } else {
      page = await this.pageRepo.findById(pageId);

      if (!page || page.workspaceId !== workspace.id) {
        throw new NotFoundException('Page not found');
      }

      await this.pageAccessService.validateCanEdit(page, user);

      spaceId = page.spaceId;
    }

    return { page, spaceId };
  }

  private draftKey(
    workspace: Workspace,
    user: User,
    pageId: string | undefined,
    templateId: string | undefined,
    type: string,
    id: string,
  ) {
    return [
      workspace.id,
      user.id,
      templateId ? 'template' : 'page',
      templateId ?? pageId,
      type,
      id,
    ].join('/');
  }

  private async resolveDraft(
    dto: DiagramDraftDto,
    user: User,
    workspace: Workspace,
  ) {
    const { page } = await this.editableTarget(
      dto.pageId,
      dto.templateId,
      user,
      workspace,
    );
    return this.draftKey(
      workspace,
      user,
      page?.id,
      dto.templateId,
      dto.type,
      dto.draftId,
    );
  }

  private async findEditableTemplate(
    templateId: string,
    user: User,
    workspace: Workspace,
  ): Promise<Template> {
    let TemplateAccessModule: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      TemplateAccessModule = require('./../../ee/template/services/template-access.service');
    } catch (err) {
      this.logger.debug(
        'Template module requested but EE module not bundled in this build',
      );
      throw new NotFoundException('Template not found');
    }

    const templateAccessService = this.moduleRef.get(
      TemplateAccessModule.TemplateAccessService,
      { strict: false },
    );
    return templateAccessService.findEditableTemplate(
      templateId,
      user,
      workspace,
    );
  }

  private async canViewTemplateFile(
    attachment: Attachment,
    user: User,
    workspace: Workspace,
  ): Promise<boolean> {
    const template = await this.templateRepo.findById(
      attachment.templateId,
      workspace.id,
    );
    if (!template) {
      return false;
    }

    if (!template.spaceId) {
      return true;
    }

    const roles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      template.spaceId,
    );
    return Boolean(roles?.length);
  }

  private async sendFileResponse(
    req: FastifyRequest,
    res: FastifyReply,
    attachment: Attachment,
    cacheScope: 'private' | 'public',
  ) {
    const fileSize = Number(attachment.fileSize);
    const rangeHeader = req.headers.range;

    res.header('Accept-Ranges', 'bytes');
    res.header(
      'Content-Security-Policy',
      "base-uri 'none'; object-src 'self'; default-src 'self';",
    );

    if (!inlineFileExtensions.includes(attachment.fileExt)) {
      res.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
      );
    }

    if (rangeHeader && fileSize) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2]
          ? Math.min(parseInt(match[2], 10), fileSize - 1)
          : fileSize - 1;

        if (start >= fileSize || start > end) {
          res.status(416);
          res.header('Content-Range', `bytes */${fileSize}`);
          return res.send();
        }

        const fileStream = await this.storageService.readRangeStream(
          attachment.filePath,
          { start, end },
        );

        res.status(206);
        res.headers({
          'Content-Type': attachment.mimeType,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': end - start + 1,
          'Cache-Control': `${cacheScope}, max-age=3600`,
        });

        return res.send(fileStream);
      }
    }

    const fileStream = await this.storageService.readStream(
      attachment.filePath,
    );

    res.headers({
      'Content-Type': attachment.mimeType,
      'Cache-Control': `${cacheScope}, max-age=3600`,
    });

    const isSvg = attachment.fileExt === '.svg';
    if (fileSize && !isSvg) {
      res.header('Content-Length', fileSize);
    }

    return res.send(fileStream);
  }
}
